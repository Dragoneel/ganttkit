/**
 * @ganttkit/svg  plain HTML/CSS/JS SVG renderer for GanttKit.
 *
 * Maps the engine's renderer-agnostic vector primitives 1:1 onto SVG elements.
 *
 * ```ts
 * import { createGantt } from '@ganttkit/svg'
 * import '@ganttkit/svg/styles.css'
 *
 * const gantt = createGantt({ target: '#app', rows })
 * ```
 */
import type { GanttOptions, GanttPlugin } from '@ganttkit/core'
import { GanttEngine } from '@ganttkit/core'
import { SvgRenderer, type SvgRendererOptions } from './renderer'

export { SvgRenderer } from './renderer'
export type { SvgRendererOptions } from './renderer'

/** A GanttKit plugin that renders the chart into a DOM element as SVG. */
export function svgRenderer(options: SvgRendererOptions): GanttPlugin {
  let renderer: SvgRenderer | null = null
  return {
    name: 'svg-renderer',
    install(ctx) {
      renderer = new SvgRenderer(ctx, options)
      return () => {
        renderer?.destroy()
        renderer = null
      }
    },
  }
}

/** Options for {@link createGantt}: engine options plus renderer options. */
export type CreateGanttOptions = GanttOptions & SvgRendererOptions

/**
 * Convenience: create an engine and attach the SVG renderer in one call.
 * Returns the engine so you can call `setRows`, `use(...)` more plugins, etc.
 */
export function createGantt(options: CreateGanttOptions): GanttEngine {
  const { target, theme, enableZoom, enablePan, ...engineOptions } = options
  const engine = new GanttEngine(engineOptions)
  engine.use(svgRenderer({ target, theme, enableZoom, enablePan }))
  return engine
}
