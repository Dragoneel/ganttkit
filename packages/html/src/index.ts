/**
 * @ganttkit/html  plain HTML/CSS/JS renderer for GanttKit.
 *
 * The DOM-twin of `@ganttkit/svg`: it consumes the same renderer-agnostic
 * scene of vector primitives but paints them as positioned `<div>`s instead of
 * SVG, so every feature plugin works unchanged.
 *
 * ```ts
 * import { createGantt } from '@ganttkit/html'
 * import '@ganttkit/html/styles.css'
 *
 * const gantt = createGantt({ target: '#app', rows })
 * ```
 */
import type { GanttOptions, GanttPlugin } from '@ganttkit/core'
import { GanttEngine } from '@ganttkit/core'
import { HtmlRenderer, type HtmlRendererOptions } from './renderer'

export { HtmlRenderer } from './renderer'
export type { HtmlRendererOptions } from './renderer'

/** A GanttKit plugin that renders the chart into a DOM element using HTML. */
export function htmlRenderer(options: HtmlRendererOptions): GanttPlugin {
  let renderer: HtmlRenderer | null = null
  return {
    name: 'html-renderer',
    install(ctx) {
      renderer = new HtmlRenderer(ctx, options)
      return () => {
        renderer?.destroy()
        renderer = null
      }
    },
  }
}

/** Options for {@link createGantt}: engine options plus renderer options. */
export type CreateGanttOptions = GanttOptions & HtmlRendererOptions

/**
 * Convenience: create an engine and attach the HTML renderer in one call.
 * Returns the engine so you can call `setRows`, `use(...)` more plugins, etc.
 */
export function createGantt(options: CreateGanttOptions): GanttEngine {
  const { target, theme, enableZoom, enablePan, ...engineOptions } = options
  const engine = new GanttEngine(engineOptions)
  engine.use(htmlRenderer({ target, theme, enableZoom, enablePan }))
  return engine
}
