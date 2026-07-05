import type { ViewMode } from '../types'

/** Coarse-to-fine ordering of the built-in view modes. */
export const VIEW_MODE_ORDER: ViewMode[] = ['Day', 'Week', 'Month']

/**
 * Step the view mode by `direction` (+1 = coarser, -1 = finer), clamped to the
 * ends. Returns the same mode when already at a boundary.
 */
export function stepViewMode(current: ViewMode, direction: 1 | -1): ViewMode {
  const idx = VIEW_MODE_ORDER.indexOf(current)
  const next = Math.min(Math.max(idx + direction, 0), VIEW_MODE_ORDER.length - 1)
  return VIEW_MODE_ORDER[next]!
}

/**
 * Map a wheel delta to a view-mode change for ctrl/⌘-wheel zoom.
 * Scrolling up (negative delta) zooms toward a coarser overview.
 */
export function wheelToViewMode(current: ViewMode, deltaY: number): ViewMode {
  return stepViewMode(current, deltaY < 0 ? 1 : -1)
}
