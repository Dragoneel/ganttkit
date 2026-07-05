/**
 * @ganttkit/plugin-markers  vertical date markers and bands.
 *
 * A scene-hook plugin for deadlines, a "now" line, sprint/release boundaries, or
 * shaded date ranges. Pure engine-side, so it works with every renderer.
 *
 * ```ts
 * import { createMarkers, todayMarker } from '@ganttkit/plugin-markers'
 * const markers = createMarkers([
 *   todayMarker(),
 *   { id: 'ga', date: '2026-08-15', label: 'GA', className: 'is-deadline' },
 *   { id: 'sprint', date: '2026-07-01', end: '2026-07-14', label: 'Sprint 1' },
 * ])
 * engine.use(markers.plugin)
 * ```
 */
import type { DateInput, GanttPlugin, Scene, SceneLayer, ScenePrimitive } from '@ganttkit/core'

export interface GanttMarker {
  /** Stable id (used as the render key and for `removeMarker`). */
  id?: string
  /** The marker date (a line), or the start of a band when `end` is set. */
  date: DateInput
  /** When set, draws a shaded band from `date` to `end` (inclusive). */
  end?: DateInput
  /** Optional label drawn at the top of the line/band. */
  label?: string
  /** Extra class on the marker element(s). */
  className?: string
}

export interface GanttMarkers {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  setMarkers: (markers: GanttMarker[]) => void
  addMarker: (marker: GanttMarker) => void
  removeMarker: (id: string) => void
  clearMarkers: () => void
}

/** A marker for the current day. */
export function todayMarker(options: { id?: string, label?: string, className?: string } = {}): GanttMarker {
  return {
    id: options.id ?? 'today',
    date: new Date(),
    label: options.label,
    className: options.className ? `gantt-marker--today ${options.className}` : 'gantt-marker--today',
  }
}

function insertAfter(scene: Scene, afterName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === afterName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? 0 : idx + 1, 0, layer)
  return { ...scene, layers }
}

export function createMarkers(initial: GanttMarker[] = []): GanttMarkers {
  let markers = [...initial]
  let refresh: (() => void) | null = null

  const plugin: GanttPlugin = {
    name: 'markers',
    install(ctx) {
      refresh = () => ctx.engine.refresh()
      return ctx.hooks.scene.tap((scene, { scale, options }) => {
        if (markers.length === 0)
          return scene
        const adapter = options.dateAdapter
        const primitives: ScenePrimitive[] = []

        markers.forEach((m, i) => {
          const key = m.id ?? `marker-${i}`
          const start = adapter.startOfDay(adapter.parse(m.date))
          const x = scale.dateToX(start)
          const cls = m.className ? `gantt-marker ${m.className}` : 'gantt-marker'

          if (m.end != null) {
            const end = adapter.startOfDay(adapter.parse(m.end))
            const x2 = scale.dateToX(adapter.addDays(end, 1)) // inclusive end day
            primitives.push({
              type: 'rect',
              key: `${key}-band`,
              className: `gantt-marker-band ${m.className ?? ''}`.trim(),
              x,
              y: 0,
              width: Math.max(0, x2 - x),
              height: scene.height,
            })
          }
          else {
            primitives.push({ type: 'line', key, className: cls, x1: x, y1: 0, x2: x, y2: scene.height })
          }

          if (m.label) {
            primitives.push({
              type: 'text',
              key: `${key}-label`,
              className: 'gantt-marker-label',
              x: x + 4,
              y: 12,
              text: m.label,
              anchor: 'start',
              baseline: 'hanging',
            })
          }
        })

        // Behind the bars (after grid) so bars stay readable; bands shade the column.
        return insertAfter(scene, 'grid', { name: 'markers', primitives })
      })
    },
  }

  const controller: GanttMarkers = {
    plugin,
    setMarkers(next) {
      markers = [...next]
      refresh?.()
    },
    addMarker(marker) {
      markers = [...markers, marker]
      refresh?.()
    },
    removeMarker(id) {
      markers = markers.filter(m => m.id !== id)
      refresh?.()
    },
    clearMarkers() {
      markers = []
      refresh?.()
    },
  }

  return controller
}
