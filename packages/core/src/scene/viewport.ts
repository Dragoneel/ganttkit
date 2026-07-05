import type { TimeScale } from '../time/time-scale'

/**
 * The visible region of the chart, in content pixels. Supplied by a renderer
 * (from its scroll container) so the engine can build a windowed scene.
 *
 * `width`/`height` are the visible *chart* size  exclude a sticky sidebar from
 * `width`. `scrollLeft` is the chart's own x at the left edge of the viewport.
 */
export interface Viewport {
  scrollTop: number
  scrollLeft: number
  width: number
  height: number
}

/** Half-open index ranges of rows and day columns to render. */
export interface SceneWindow {
  /** First visible row index (inclusive). */
  rowStart: number
  /** One past the last visible row index. */
  rowEnd: number
  /** First visible day index (inclusive). */
  dayStart: number
  /** One past the last visible day index. */
  dayEnd: number
}

export interface WindowParams {
  rowCount: number
  rowHeight: number
  /** Extra rows rendered above/below the viewport to mask fast scrolling. */
  overscanRows: number
  /** Extra day columns rendered left/right of the viewport. */
  overscanCols: number
}

/**
 * Resolve which rows and day columns intersect the viewport (plus overscan),
 * clamped to the dataset. Rows and columns are uniform, so this is O(1).
 */
export function resolveWindow(viewport: Viewport, scale: TimeScale, params: WindowParams): SceneWindow {
  const { rowCount, rowHeight, overscanRows, overscanCols } = params

  const rowStart = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscanRows)
  const rowEnd = Math.min(rowCount, Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + overscanRows)

  const dayStart = Math.max(0, Math.floor(viewport.scrollLeft / scale.dayWidth) - overscanCols)
  const dayEnd = Math.min(scale.totalDays, Math.ceil((viewport.scrollLeft + viewport.width) / scale.dayWidth) + overscanCols)

  return {
    rowStart,
    rowEnd: Math.max(rowStart, rowEnd),
    dayStart,
    dayEnd: Math.max(dayStart, dayEnd),
  }
}

/** True when two viewports are pixel-identical (skip redundant rebuilds). */
export function sameViewport(a: Viewport | null, b: Viewport | null): boolean {
  if (a === b)
    return true
  if (!a || !b)
    return false
  return a.scrollTop === b.scrollTop && a.scrollLeft === b.scrollLeft && a.width === b.width && a.height === b.height
}
