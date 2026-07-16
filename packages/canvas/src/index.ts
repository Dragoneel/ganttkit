/**
 * @ganttkit/canvas  plain HTML/CSS/JS canvas renderer for GanttKit.
 *
 * The third sibling of `@ganttkit/svg` and `@ganttkit/html`: it consumes the
 * same renderer-agnostic scene of vector primitives but draws them into a single
 * 2D `<canvas>` context, so every feature plugin works unchanged.
 *
 * ```ts
 * import { createGantt } from '@ganttkit/canvas'
 * import '@ganttkit/canvas/styles.css'
 *
 * const gantt = createGantt({ target: '#app', rows })
 * ```
 */
import type { GanttOptions, GanttPlugin } from '@ganttkit/core'
import { GanttEngine } from '@ganttkit/core'
import { CanvasRenderer, type CanvasRendererOptions } from './renderer'

export { CanvasRenderer } from './renderer'
export type { CanvasRendererOptions, ChevronContent, ChevronOption } from './renderer'

/** A GanttKit plugin that renders the chart into a DOM element using canvas. */
export function canvasRenderer(options: CanvasRendererOptions): GanttPlugin {
  let renderer: CanvasRenderer | null = null
  return {
    name: 'canvas-renderer',
    install(ctx) {
      renderer = new CanvasRenderer(ctx, options)
      return () => {
        renderer?.destroy()
        renderer = null
      }
    },
  }
}

/** Options for {@link createGantt}: engine options plus renderer options. */
export type CreateGanttOptions = GanttOptions & CanvasRendererOptions

/**
 * Convenience: create an engine and attach the canvas renderer in one call.
 * Returns the engine so you can call `setRows`, `use(...)` more plugins, etc.
 */
export function createGantt(options: CreateGanttOptions): GanttEngine {
  const { target, theme, enableZoom, enablePan, chevron, ...engineOptions } = options
  const engine = new GanttEngine(engineOptions)
  engine.use(canvasRenderer({ target, theme, enableZoom, enablePan, chevron }))
  return engine
}
