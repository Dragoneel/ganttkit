/**
 * @ganttkit/plugin-dependencies  link editing + finish-to-start auto-scheduling.
 *
 * Dependency *lines* are already drawn by the core (from each task's
 * `dependencies`). This plugin adds the behaviour:
 * - **auto-schedule**: when a task moves, push its dependents so none start
 *   before their predecessor finishes (+ optional gap),
 * - **programmatic editing**: `addDependency` / `removeDependency` with cycle
 *   detection,
 * - **commands**: `deps.add`, `deps.remove`, `deps.reschedule`.
 *
 * It operates on the engine's source rows (not the post-hook view), so it
 * composes correctly with filtering/tree plugins. Pure engine-side  no DOM.
 *
 * `task.dependencies` lists predecessor ids (the task depends on those), so
 * `addDependency(predecessorId, successorId)` adds `predecessorId` to the
 * successor's `dependencies`.
 *
 * ```ts
 * import { createDependencies } from '@ganttkit/plugin-dependencies'
 * const deps = createDependencies({ gap: 0, autoSchedule: true })
 * engine.use(deps.plugin)
 * deps.addDependency('design', 'build') // build now depends on design
 * ```
 */
import type { GanttEngineApi, GanttPlugin, GanttRow, Scene, SceneLayer, ScenePrimitive } from '@ganttkit/core'
import { UI_SLOTS } from '@ganttkit/core'

export interface DependenciesOptions {
  /** Minimum days between a predecessor's end and a dependent's start. Default `0`. */
  gap?: number
  /** Shift dependents automatically when a task moves. Default `true`. */
  autoSchedule?: boolean
  /**
   * Show connector handles and let the user drag from one task to another to
   * create a link. Needs a renderer that hosts UI slots. Default `true`.
   */
  linkDrag?: boolean
}

function insertAfter(scene: Scene, afterName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === afterName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? layers.length : idx + 1, 0, layer)
  return { ...scene, layers }
}

export interface GanttDependencies {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  /** Make `successorId` depend on `predecessorId`. Returns `false` if it would create a cycle. */
  addDependency: (predecessorId: string, successorId: string) => boolean
  /** Remove the dependency. Returns `true` if one was removed. */
  removeDependency: (predecessorId: string, successorId: string) => boolean
  /** Enforce all finish-to-start constraints now. Returns the number of tasks shifted. */
  reschedule: () => number
}

function deps(task: { dependencies?: string[] }): string[] {
  return task.dependencies ?? []
}

/** Does `from` (transitively) depend on `target`, following the dependency graph? */
function dependsOnReaches(graph: Map<string, string[]>, from: string, target: string): boolean {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === target)
      return true
    if (seen.has(cur))
      continue
    seen.add(cur)
    for (const d of graph.get(cur) ?? [])
      stack.push(d)
  }
  return false
}

export function createDependencies(options: DependenciesOptions = {}): GanttDependencies {
  const gap = options.gap ?? 0
  const autoSchedule = options.autoSchedule ?? true
  const linkDrag = options.linkDrag ?? true
  let engine: GanttEngineApi | null = null

  function findTask(rows: GanttRow[], id: string) {
    for (const row of rows) {
      const task = row.tasks.find(t => t.id === id)
      if (task)
        return task
    }
    return null
  }

  const controller: GanttDependencies = {
    plugin: {
      name: 'dependencies',
      install(ctx) {
        engine = ctx.engine
        const offs = [
          ctx.commands.register('deps.add', (a: string, b: string) => controller.addDependency(a, b)),
          ctx.commands.register('deps.remove', (a: string, b: string) => controller.removeDependency(a, b)),
          ctx.commands.register('deps.reschedule', () => controller.reschedule()),
        ]
        if (autoSchedule) {
          offs.push(ctx.events.on('task:dragend', ({ changed }) => {
            if (changed)
              controller.reschedule()
          }))
        }
        if (linkDrag) {
          // Connector handles at each bar's right edge (tagged `data-link-source`,
          // not `data-task-id`, so the renderer's move/resize ignores them).
          offs.push(ctx.hooks.scene.tap((scene, { layouts }) => {
            const primitives: ScenePrimitive[] = layouts
              .filter(l => !l.isMilestone)
              .map(l => ({
                type: 'rect' as const,
                key: `conn-${l.task.id}`,
                className: 'gantt-connector',
                x: l.x + l.width - 4,
                y: l.cy - 4,
                width: 8,
                height: 8,
                rx: 4,
                data: { 'link-source': l.task.id },
              }))
            if (primitives.length === 0)
              return scene
            return insertAfter(scene, 'bars', { name: 'connectors', primitives })
          }))
          offs.push(ctx.ui.register({
            slot: UI_SLOTS.overlay,
            id: 'link-drag',
            mount: ({ element, viewport }) => mountLinkDrag(element, viewport, controller),
          }))
        }
        return () => {
          for (const off of offs)
            off()
          engine = null
        }
      },
    },

    addDependency(predecessorId, successorId) {
      if (!engine || predecessorId === successorId)
        return false
      const rows = engine.getState().rows
      const successor = findTask(rows, successorId)
      if (!successor || !findTask(rows, predecessorId))
        return false
      if (deps(successor).includes(predecessorId))
        return true

      // Reject if predecessor already (transitively) depends on the successor.
      const graph = new Map<string, string[]>()
      for (const row of rows) {
        for (const t of row.tasks)
          graph.set(t.id, deps(t))
      }
      if (dependsOnReaches(graph, predecessorId, successorId))
        return false

      const next = rows.map(row => ({
        ...row,
        tasks: row.tasks.map(t => (t.id === successorId ? { ...t, dependencies: [...deps(t), predecessorId] } : t)),
      }))
      engine.setRows(next)
      if (autoSchedule)
        controller.reschedule()
      return true
    },

    removeDependency(predecessorId, successorId) {
      if (!engine)
        return false
      const rows = engine.getState().rows
      const successor = findTask(rows, successorId)
      if (!successor || !deps(successor).includes(predecessorId))
        return false
      const next = rows.map(row => ({
        ...row,
        tasks: row.tasks.map(t => (t.id === successorId ? { ...t, dependencies: deps(t).filter(d => d !== predecessorId) } : t)),
      }))
      engine.setRows(next)
      return true
    },

    reschedule() {
      if (!engine)
        return 0
      const rows = engine.getState().rows
      const adapter = engine.getOptions().dateAdapter

      const info = new Map<string, { start: Date, end: Date, deps: string[] }>()
      for (const row of rows) {
        for (const t of row.tasks) {
          try {
            info.set(t.id, {
              start: adapter.startOfDay(adapter.parse(t.start)),
              end: adapter.startOfDay(adapter.parse(t.end)),
              deps: deps(t),
            })
          }
          catch {
            // skip tasks with unparseable dates
          }
        }
      }

      // Relax finish-to-start constraints. Bounded iterations guard against
      // cyclic input data (addDependency already prevents creating cycles).
      const shifted = new Set<string>()
      let changed = true
      let iterations = 0
      while (changed && iterations++ <= info.size) {
        changed = false
        for (const [id, t] of info) {
          let required: Date | null = null
          for (const depId of t.deps) {
            const p = info.get(depId)
            if (!p)
              continue
            const candidate = adapter.addDays(p.end, 1 + gap)
            if (!required || candidate > required)
              required = candidate
          }
          if (required && required > t.start) {
            const delta = adapter.diffDays(t.start, required)
            t.start = required
            t.end = adapter.addDays(t.end, delta)
            shifted.add(id)
            changed = true
          }
        }
      }

      if (shifted.size === 0)
        return 0

      const next = rows.map(row => ({
        ...row,
        tasks: row.tasks.map((t) => {
          if (!shifted.has(t.id))
            return t
          const u = info.get(t.id)!
          return { ...t, start: u.start, end: u.end }
        }),
      }))
      engine.setRows(next)
      return shifted.size
    },
  }

  return controller
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Overlay drag-to-create: grab a connector, drop on a task → addDependency. */
function mountLinkDrag(element: HTMLElement, viewport: HTMLElement, controller: GanttDependencies): () => void {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'gantt__link-svg')
  svg.style.display = 'none'
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('class', 'gantt__link-line')
  svg.appendChild(path)
  element.appendChild(svg)

  let sourceId: string | null = null
  let sx = 0
  let sy = 0

  const draw = (px: number, py: number) => {
    const dx = Math.abs(px - sx) * 0.5
    path.setAttribute('d', `M ${sx} ${sy} C ${sx + dx} ${sy}, ${px - dx} ${py}, ${px} ${py}`)
  }

  const onMove = (e: MouseEvent) => {
    const r = element.getBoundingClientRect()
    draw(e.clientX - r.left, e.clientY - r.top)
  }
  const onUp = (e: MouseEvent) => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    svg.style.display = 'none'
    const target = (e.target as Element | null)?.closest('[data-task-id]')
    const targetId = target?.getAttribute('data-task-id')
    if (sourceId && targetId && targetId !== sourceId)
      controller.addDependency(sourceId, targetId)
    sourceId = null
  }

  const onDown = (e: MouseEvent) => {
    const handle = (e.target as Element | null)?.closest('[data-link-source]')
    if (!handle)
      return
    e.preventDefault()
    e.stopPropagation()
    sourceId = handle.getAttribute('data-link-source')
    const hr = handle.getBoundingClientRect()
    const r = element.getBoundingClientRect()
    sx = hr.left + hr.width / 2 - r.left
    sy = hr.top + hr.height / 2 - r.top
    svg.style.display = ''
    draw(sx, sy)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  viewport.addEventListener('mousedown', onDown)
  return () => {
    viewport.removeEventListener('mousedown', onDown)
    svg.remove()
  }
}
