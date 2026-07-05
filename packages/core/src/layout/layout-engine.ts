import type { GanttRow, GanttTask } from '../types'
import type { DateAdapter } from '../time/date-adapter'
import type { TimeScale } from '../time/time-scale'

/** Computed geometry for one task, in timeline coordinates. */
export interface TaskLayout {
  task: GanttTask
  rowId: string
  rowIndex: number
  isMilestone: boolean
  /** Left edge of the bar (px). For milestones, the anchor's left edge. */
  x: number
  /** Top edge of the bar (px). */
  y: number
  /** Bar width (px). For milestones this is the day span used for anchoring. */
  width: number
  /** Bar height (px). */
  height: number
  /** Vertical centre of the row (px)  handy for markers and links. */
  cy: number
}

/** Total height of the chart body in px. */
export function contentHeight(rowCount: number, rowHeight: number): number {
  return rowCount * rowHeight
}

/**
 * Compute geometry for every task across all rows.
 *
 * Bars span `[start, end]` inclusive (so a same-day task is one day wide).
 * Tasks with unparseable dates are skipped and reported via `onInvalid`.
 *
 * `baseRowIndex` is added to each row's local index so a *slice* of rows lays
 * out at its absolute vertical position  this is what makes viewport
 * virtualization possible (lay out only the visible rows, still positioned
 * correctly).
 */
export function computeTaskLayouts(
  rows: GanttRow[],
  scale: TimeScale,
  rowHeight: number,
  barPadding: number,
  adapter: DateAdapter,
  onInvalid?: (task: GanttTask, error: unknown) => void,
  baseRowIndex = 0,
): TaskLayout[] {
  const layouts: TaskLayout[] = []
  const barHeight = rowHeight - barPadding * 2

  rows.forEach((row, localIndex) => {
    const rowIndex = baseRowIndex + localIndex
    for (const task of row.tasks) {
      let start: Date
      let end: Date
      try {
        start = adapter.startOfDay(adapter.parse(task.start))
        end = adapter.startOfDay(adapter.parse(task.end))
      }
      catch (error) {
        onInvalid?.(task, error)
        continue
      }

      const span = Math.max(adapter.diffDays(start, end) + 1, 1)
      layouts.push({
        task,
        rowId: row.id,
        rowIndex,
        isMilestone: task.kind === 'milestone',
        x: scale.dateToX(start),
        y: rowIndex * rowHeight + barPadding,
        width: span * scale.dayWidth,
        height: barHeight,
        cy: rowIndex * rowHeight + rowHeight / 2,
      })
    }
  })

  return layouts
}
