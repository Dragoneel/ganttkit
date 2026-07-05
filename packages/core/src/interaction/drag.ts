import type { GanttTask } from '../types'
import type { DateAdapter } from '../time/date-adapter'

/** What a drag gesture changes about a task. */
export type DragMode = 'move' | 'resize-left' | 'resize-right'

/** Live state of an in-progress drag. Pure data  no DOM references. */
export interface DragState {
  taskId: string
  rowId: string
  mode: DragMode
  /** Pointer x where the gesture began (client/SVG coordinates). */
  startX: number
  /** Raw pixel offset from the start point. */
  offsetPx: number
  /** Snapped offset in whole days. */
  offsetDays: number
  /** Effective px-per-day at gesture start (for snapping). */
  dayWidth: number
}

/** Create the initial drag state for a gesture. */
export function beginDrag(params: {
  taskId: string
  rowId: string
  mode: DragMode
  startX: number
  dayWidth: number
}): DragState {
  return { ...params, offsetPx: 0, offsetDays: 0 }
}

/** Advance a drag with the current pointer x. Returns a new state (immutable). */
export function updateDrag(state: DragState, currentX: number): DragState {
  const offsetPx = currentX - state.startX
  return {
    ...state,
    offsetPx,
    offsetDays: Math.round(offsetPx / state.dayWidth),
  }
}

/**
 * Resolve the task's new `[start, end]` for the current drag.
 *
 * `move` shifts both edges; resizes move one edge and clamp so the bar stays at
 * least one day wide. Dates are returned at local midnight.
 */
export function resolveDraggedDates(
  task: GanttTask,
  state: DragState,
  adapter: DateAdapter,
): { start: Date, end: Date } {
  const start = adapter.startOfDay(adapter.parse(task.start))
  const end = adapter.startOfDay(adapter.parse(task.end))
  const days = state.offsetDays

  switch (state.mode) {
    case 'move':
      return { start: adapter.addDays(start, days), end: adapter.addDays(end, days) }
    case 'resize-left': {
      const nextStart = adapter.addDays(start, days)
      return { start: nextStart > end ? end : nextStart, end }
    }
    case 'resize-right': {
      const nextEnd = adapter.addDays(end, days)
      return { start, end: nextEnd < start ? start : nextEnd }
    }
  }
}

/** The visual x/width deltas a renderer should apply while dragging. */
export function dragVisualDelta(state: DragState): { dx: number, dWidth: number } {
  const px = state.offsetDays * state.dayWidth
  switch (state.mode) {
    case 'move':
      return { dx: px, dWidth: 0 }
    case 'resize-left':
      return { dx: px, dWidth: -px }
    case 'resize-right':
      return { dx: 0, dWidth: px }
  }
}
