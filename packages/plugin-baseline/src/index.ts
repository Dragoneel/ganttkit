/**
 * @ganttkit/plugin-baseline  planned-vs-actual comparison bars.
 *
 * A scene-hook plugin. You snapshot a "baseline" (planned dates) and it draws a
 * ghost bar behind each task at its planned position; when the actual task has
 * slipped, the ghost peeks out so the variance is visible. Pure engine-side, so
 * it works with every renderer.
 *
 * ```ts
 * import { createBaseline } from '@ganttkit/plugin-baseline'
 * const baseline = createBaseline()
 * engine.use(baseline.plugin)
 * baseline.capture()            // snapshot current dates as the plan
 * // …user drags tasks around; ghosts now show the slip…
 * baseline.clear()
 * ```
 */
import type {
  DateInput,
  GanttEngineApi,
  GanttPlugin,
  Scene,
  SceneLayer,
  ScenePrimitive,
} from '@ganttkit/core'

export interface BaselineEntry {
  start: DateInput
  end: DateInput
}

/** Planned dates keyed by task id. */
export type BaselineMap = Record<string, BaselineEntry>

export interface GanttBaseline {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  /** Set the baseline explicitly. */
  setBaseline: (map: BaselineMap) => void
  /** Snapshot the current task dates as the baseline. */
  capture: () => void
  /** Remove the baseline (ghosts disappear). */
  clear: () => void
  /** Current baseline. */
  get: () => BaselineMap
}

function insertBefore(scene: Scene, beforeName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === beforeName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? layers.length : idx, 0, layer)
  return { ...scene, layers }
}

export function createBaseline(initial: BaselineMap = {}): GanttBaseline {
  let baseline: BaselineMap = { ...initial }
  let engine: GanttEngineApi | null = null
  let refresh: (() => void) | null = null

  const plugin: GanttPlugin = {
    name: 'baseline',
    install(ctx) {
      engine = ctx.engine
      refresh = () => ctx.engine.refresh()
      const offCmds = [
        ctx.commands.register('baseline.capture', () => controller.capture()),
        ctx.commands.register('baseline.clear', () => controller.clear()),
      ]
      const offScene = ctx.hooks.scene.tap((scene, { layouts, scale, options }) => {
        const adapter = options.dateAdapter
        const primitives: ScenePrimitive[] = []
        for (const l of layouts) {
          if (l.isMilestone)
            continue
          const entry = baseline[l.task.id]
          if (!entry)
            continue
          let start: Date
          let end: Date
          try {
            start = adapter.startOfDay(adapter.parse(entry.start))
            end = adapter.startOfDay(adapter.parse(entry.end))
          }
          catch {
            continue
          }
          const span = Math.max(adapter.diffDays(start, end) + 1, 1)
          primitives.push({
            type: 'rect',
            key: `baseline-${l.task.id}`,
            className: 'gantt-baseline',
            x: scale.dateToX(start),
            y: l.y,
            width: span * scale.dayWidth,
            height: l.height,
            rx: 3,
            data: { 'task-id': l.task.id },
          })
        }
        if (primitives.length === 0)
          return scene
        // Behind the bars, so the actual bar paints on top and the ghost shows on slip.
        return insertBefore(scene, 'bars', { name: 'baseline', primitives })
      })
      return () => {
        offScene()
        for (const off of offCmds) off()
        refresh = null
        engine = null
      }
    },
  }

  const controller: GanttBaseline = {
    plugin,
    setBaseline(map) {
      baseline = { ...map }
      refresh?.()
    },
    capture() {
      if (!engine)
        return
      const map: BaselineMap = {}
      for (const row of engine.getRows()) {
        for (const task of row.tasks)
          map[task.id] = { start: task.start, end: task.end }
      }
      baseline = map
      refresh?.()
    },
    clear() {
      baseline = {}
      refresh?.()
    },
    get: () => ({ ...baseline }),
  }

  return controller
}
