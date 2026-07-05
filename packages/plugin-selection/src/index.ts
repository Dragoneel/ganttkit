/**
 * @ganttkit/plugin-selection  select tasks, rubber-band, and a context menu.
 *
 * Combines engine-side state + a scene-hook highlight (renderer-agnostic) with a
 * UI-slot overlay for shift-drag rubber-band selection and a right-click menu.
 *
 * - Click a task to select; ctrl/⌘/shift-click to toggle (multi).
 * - Shift-drag on empty space to rubber-band select; plain empty click clears.
 * - Right-click for a context menu (when `menu` items are provided).
 *
 * ```ts
 * import { createSelection } from '@ganttkit/plugin-selection'
 * const selection = createSelection({
 *   menu: [{ label: 'Delete', action: ids => console.log('delete', ids) }],
 * })
 * engine.use(selection.plugin)
 * ```
 */
import type { GanttPlugin, GanttViewportPort, Scene, SceneLayer, ScenePrimitive } from '@ganttkit/core'
import { GANTT_VIEWPORT_SERVICE, UI_SLOTS } from '@ganttkit/core'

export interface ContextMenuItem {
  label: string
  action: (selectedIds: string[]) => void
}

export interface SelectionOptions {
  /** Allow selecting more than one task. Default `true`. */
  multi?: boolean
  /** Enable shift-drag rubber-band selection. Default `true`. */
  rubberBand?: boolean
  /** Right-click context-menu items. Default none. */
  menu?: ContextMenuItem[]
}

export interface GanttSelection {
  readonly plugin: GanttPlugin
  getSelected: () => string[]
  select: (ids: string[]) => void
  toggle: (id: string) => void
  clear: () => void
}

function insertAfter(scene: Scene, afterName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === afterName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? layers.length : idx + 1, 0, layer)
  return { ...scene, layers }
}

export function createSelection(options: SelectionOptions = {}): GanttSelection {
  const multi = options.multi !== false
  const rubberBand = options.rubberBand !== false
  const menu = options.menu ?? []
  const selected = new Set<string>()
  let refresh: (() => void) | null = null

  function setSelection(ids: string[]) {
    selected.clear()
    for (const id of ids)
      selected.add(id)
    refresh?.()
  }
  function addSelection(ids: string[]) {
    for (const id of ids)
      selected.add(id)
    refresh?.()
  }

  const controller: GanttSelection = {
    plugin: {
      name: 'selection',
      install(ctx) {
        refresh = () => ctx.engine.refresh()

        // Highlight selected bars (renderer-agnostic).
        const offScene = ctx.hooks.scene.tap((scene, { layouts }) => {
          if (selected.size === 0)
            return scene
          const primitives: ScenePrimitive[] = layouts
            .filter(l => selected.has(l.task.id))
            .map(l => ({
              type: 'rect' as const,
              key: `sel-${l.task.id}`,
              className: 'gantt-selected',
              x: l.x - 1,
              y: l.y - 1,
              width: l.width + 2,
              height: l.height + 2,
              rx: 4,
            }))
          if (primitives.length === 0)
            return scene
          return insertAfter(scene, 'bars', { name: 'selection', primitives })
        })

        // Click selection (uses the renderer-emitted engine event).
        const offClick = ctx.events.on('task:click', ({ task, originalEvent }) => {
          const e = originalEvent as MouseEvent | undefined
          const additive = multi && !!(e && (e.ctrlKey || e.metaKey || e.shiftKey))
          if (additive)
            controller.toggle(task.id)
          else
            setSelection([task.id])
        })

        // Overlay: rubber-band + context menu + clear-on-empty-click.
        const offUi = ctx.ui.register({
          slot: UI_SLOTS.overlay,
          id: 'selection',
          mount: ({ element, viewport, engine }) => mountOverlay(element, viewport, engine),
        })

        return () => {
          offScene()
          offClick()
          offUi()
          refresh = null
        }
      },
    },
    getSelected: () => [...selected],
    select: ids => setSelection(ids),
    toggle(id) {
      if (selected.has(id))
        selected.delete(id)
      else
        selected.add(id)
      refresh?.()
    },
    clear() {
      if (selected.size > 0)
        setSelection([])
    },
  }

  function mountOverlay(
    element: HTMLElement,
    viewport: HTMLElement,
    engine: import('@ganttkit/core').GanttEngineApi,
  ): () => void {
    let rubber: HTMLDivElement | null = null
    let startX = 0
    let startY = 0
    let withShift = false

    // The renderer maps client → scene coordinates; the engine owns the geometry.
    // No DOM hit-testing, so this works for SVG, HTML and canvas alike.
    const vp = engine.consume<GanttViewportPort>(GANTT_VIEWPORT_SERVICE)
    const taskAt = (clientX: number, clientY: number): string | null => {
      const p = vp?.clientToScene(clientX, clientY)
      return p ? (engine.hitTest(p.x, p.y)?.taskId ?? null) : null
    }
    const hitTest = (ax: number, ay: number, bx: number, by: number): string[] => {
      if (!vp)
        return []
      const a = vp.clientToScene(ax, ay)
      const b = vp.clientToScene(bx, by)
      return engine.hitTestRegion(a.x, a.y, b.x, b.y)
    }

    const positionRubber = (e: MouseEvent) => {
      if (!rubber)
        return
      const r = element.getBoundingClientRect()
      rubber.style.left = `${Math.min(startX, e.clientX) - r.left}px`
      rubber.style.top = `${Math.min(startY, e.clientY) - r.top}px`
      rubber.style.width = `${Math.abs(e.clientX - startX)}px`
      rubber.style.height = `${Math.abs(e.clientY - startY)}px`
    }

    const onMove = (e: MouseEvent) => positionRubber(e)
    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY)
      if (rubber) {
        const ids = hitTest(startX, startY, e.clientX, e.clientY)
        if (withShift)
          addSelection(ids)
        else
          setSelection(ids)
        rubber.remove()
        rubber = null
      }
      else if (moved < 4) {
        controller.clear()
      }
    }

    const onDown = (e: MouseEvent) => {
      // Bail on non-primary buttons, or when the press starts on a task (those
      // are drag/click gestures the renderer owns, not rubber-band).
      if (e.button !== 0 || taskAt(e.clientX, e.clientY))
        return
      withShift = e.shiftKey
      startX = e.clientX
      startY = e.clientY
      if (withShift && rubberBand) {
        rubber = document.createElement('div')
        rubber.className = 'gantt__rubber'
        element.appendChild(rubber)
        positionRubber(e)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    viewport.addEventListener('mousedown', onDown)

    let onCtx: ((e: MouseEvent) => void) | null = null
    if (menu.length > 0) {
      onCtx = (e: MouseEvent) => {
        const id = taskAt(e.clientX, e.clientY)
        if (!id)
          return
        e.preventDefault()
        if (!selected.has(id))
          setSelection([id])
        openMenu(element, e.clientX, e.clientY, menu, () => controller.getSelected())
      }
      viewport.addEventListener('contextmenu', onCtx)
    }

    return () => {
      viewport.removeEventListener('mousedown', onDown)
      if (onCtx)
        viewport.removeEventListener('contextmenu', onCtx)
      rubber?.remove()
    }
  }

  return controller
}

function openMenu(host: HTMLElement, clientX: number, clientY: number, items: ContextMenuItem[], getIds: () => string[]) {
  host.querySelector('.gantt__menu')?.remove()
  const menu = document.createElement('div')
  menu.className = 'gantt__menu'
  const r = host.getBoundingClientRect()
  menu.style.left = `${clientX - r.left}px`
  menu.style.top = `${clientY - r.top}px`
  for (const item of items) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'gantt__menu-item'
    btn.textContent = item.label
    btn.addEventListener('click', () => {
      item.action(getIds())
      menu.remove()
    })
    menu.appendChild(btn)
  }
  host.appendChild(menu)
  const close = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove()
      document.removeEventListener('mousedown', close, true)
    }
  }
  setTimeout(() => document.addEventListener('mousedown', close, true), 0)
}
