/**
 * @ganttkit/plugin-progress  draw task completion inside bars.
 *
 * A scene-hook plugin: for every task with a `progress` value in `[0, 1]` it
 * overlays a fill rect spanning that fraction of the bar. Pure engine-side, so
 * it works with every renderer (svg, html, canvas, vue, nuxt).
 *
 * ```ts
 * import { progressPlugin } from '@ganttkit/plugin-progress'
 * engine.use(progressPlugin())
 * // tasks: { id, name, start, end, progress: 0.6 }
 * ```
 */
import type { GanttPlugin, Scene, SceneLayer, ScenePrimitive } from '@ganttkit/core'

export interface ProgressOptions {
  /** Extra class added to each progress rect. */
  className?: string
}

/** Insert `layer` immediately after the named layer (or at the end). */
function insertAfter(scene: Scene, afterName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === afterName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? layers.length : idx + 1, 0, layer)
  return { ...scene, layers }
}

export function progressPlugin(options: ProgressOptions = {}): GanttPlugin {
  const className = options.className ? `gantt-progress ${options.className}` : 'gantt-progress'
  return {
    name: 'progress',
    install(ctx) {
      return ctx.hooks.scene.tap((scene, { layouts }) => {
        const primitives: ScenePrimitive[] = []
        for (const l of layouts) {
          if (l.isMilestone)
            continue
          const value = l.task.progress
          if (value == null)
            continue
          const ratio = Math.max(0, Math.min(1, value))
          if (ratio <= 0)
            continue
          primitives.push({
            type: 'rect',
            key: `progress-${l.task.id}`,
            className,
            x: l.x,
            y: l.y,
            width: l.width * ratio,
            height: l.height,
            rx: 3,
            data: { 'task-id': l.task.id },
          })
        }
        if (primitives.length === 0)
          return scene
        // Above the bars, below labels, so the % fill shows but text stays readable.
        return insertAfter(scene, 'bars', { name: 'progress', primitives })
      })
    },
  }
}
