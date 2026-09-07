import type { RendererFactory, ViewMode } from '@ganttkit/core'

/**
 * The base renderer to paint with, by name.
 *
 * Names rather than factories, because `nuxt.config` is read at build time and
 * a function there could not be handed to the client bundle. The module turns
 * the name into a static import of that package's factory, so the two
 * renderers you did not pick never reach the bundle.
 */
export type RendererName = 'html' | 'svg' | 'canvas'

/**
 * Chart options that can be set once in `nuxt.config` and apply to every
 * `<GanttChart>` in the app.
 *
 * This is the serializable half of the component's props: the module inlines
 * these into a generated module, so anything JSON cannot carry - `rows`,
 * `plugins`, `chevron`, `dateAdapter` - stays a prop. Dates are `string` or
 * `number` here for the same reason; a `Date` would not survive the write.
 */
export interface GanttChartDefaults {
  /** Timeline granularity. Default `Week`. */
  viewMode?: ViewMode
  /** `light` (default) or `dark`. */
  theme?: 'light' | 'dark'
  /** Force a timeline start. Derived from the task dates when omitted. */
  startDate?: string | number | null
  /** Force a timeline end. Derived from the task dates when omitted. */
  endDate?: string | number | null
  rowHeight?: number
  /** Base px-per-day at `Week` view; other view modes scale it. */
  dayWidth?: number
  /** Vertical padding between a bar and its row edges. */
  barPadding?: number
  /** Highlight the current day column. */
  highlightToday?: boolean
  /** Whether tasks are draggable unless overridden per-task. */
  draggable?: boolean
  /** Render only what the viewport shows. Default `true`. */
  virtualize?: boolean
  /** Extra rows rendered above/below the viewport when virtualizing. */
  overscanRows?: number
  /** Extra day columns rendered left/right of the viewport. */
  overscanCols?: number
  /** ctrl/cmd + wheel changes the view mode. Default `true`. */
  enableZoom?: boolean
  /** Click-drag the chart body to pan. Default `true`. */
  enablePan?: boolean
}

/** What the generated `#ganttkit-options` module exposes to the runtime. */
export interface GanttKitRuntimeOptions {
  /** The factory for the renderer named in `nuxt.config`. */
  renderer: RendererFactory
  /** App-wide chart defaults, already resolved. */
  defaults: GanttChartDefaults
}
