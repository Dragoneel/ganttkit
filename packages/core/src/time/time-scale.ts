import type { GanttRow, ViewMode } from '../types'
import type { DateAdapter } from './date-adapter'

/** A single day column in the timeline header/grid. */
export interface DayCell {
  key: string
  date: Date
  dayOfMonth: number
  weekday: string
  isWeekend: boolean
  isToday: boolean
  isoWeek: number
}

/** A week band spanning one or more day columns. */
export interface WeekCell {
  key: string
  /** e.g. `W26`. */
  label: string
  /** e.g. `jun 22-28`. */
  range: string
  isoWeek: number
  width: number
}

/** A month band spanning one or more day columns. */
export interface MonthCell {
  key: string
  label: string
  width: number
}

/** Per-view-mode multiplier applied to the base day width. */
export const VIEW_MODE_SCALE: Record<ViewMode, number> = {
  Day: 1.5,
  Week: 1,
  Month: 0.5,
}

/** The effective px-per-day for a base width and view mode. */
export function effectiveDayWidth(baseDayWidth: number, viewMode: ViewMode): number {
  return baseDayWidth * VIEW_MODE_SCALE[viewMode]
}

/**
 * Derive a sensible `[start, end]` window.
 *
 * Priority: explicit `startDate`/`endDate` → span of all task dates (padded to
 * whole months) → the current month plus the next two as a fallback.
 */
export function deriveDateRange(
  rows: GanttRow[],
  explicitStart: Date | null,
  explicitEnd: Date | null,
  adapter: DateAdapter,
  today: Date,
): { start: Date, end: Date } {
  if (explicitStart && explicitEnd)
    return { start: adapter.startOfDay(explicitStart), end: adapter.startOfDay(explicitEnd) }

  let min: Date | null = null
  let max: Date | null = null

  for (const row of rows) {
    for (const task of row.tasks) {
      let start: Date
      let end: Date
      try {
        start = adapter.parse(task.start)
        end = adapter.parse(task.end)
      }
      catch {
        continue // skip tasks with unparseable dates rather than crash layout
      }
      if (!min || start < min)
        min = start
      if (!max || end > max)
        max = end
    }
  }

  if (!min || !max) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 3, 0)
    return { start, end }
  }

  return {
    start: explicitStart ? adapter.startOfDay(explicitStart) : adapter.startOfMonth(min),
    end: explicitEnd ? adapter.startOfDay(explicitEnd) : adapter.endOfMonth(max),
  }
}

/**
 * Immutable description of the timeline geometry for one render pass.
 *
 * Construction is O(totalDays); the result is cached by the engine and only
 * rebuilt when the range, view mode, or day width changes.
 */
export class TimeScale {
  readonly start: Date
  readonly end: Date
  readonly viewMode: ViewMode
  readonly dayWidth: number
  readonly days: DayCell[]
  readonly weeks: WeekCell[]
  readonly months: MonthCell[]

  constructor(params: {
    start: Date
    end: Date
    viewMode: ViewMode
    baseDayWidth: number
    adapter: DateAdapter
    today: Date
  }) {
    const { start, end, viewMode, baseDayWidth, adapter, today } = params
    this.start = adapter.startOfDay(start)
    this.end = adapter.startOfDay(end)
    this.viewMode = viewMode
    this.dayWidth = effectiveDayWidth(baseDayWidth, viewMode)

    const days: DayCell[] = []
    const monthOrder: string[] = []
    const monthCount = new Map<string, { label: string, count: number }>()

    let cursor = new Date(this.start)
    while (cursor <= this.end) {
      days.push({
        key: adapter.toKey(cursor),
        date: new Date(cursor),
        dayOfMonth: cursor.getDate(),
        weekday: adapter.weekdayShort(cursor),
        isWeekend: adapter.isWeekend(cursor),
        isToday: adapter.isSameDay(cursor, today),
        isoWeek: adapter.isoWeek(cursor),
      })

      const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`
      const entry = monthCount.get(monthKey)
      if (entry) {
        entry.count++
      }
      else {
        monthCount.set(monthKey, { label: adapter.monthLabel(cursor), count: 1 })
        monthOrder.push(monthKey)
      }

      cursor = adapter.addDays(cursor, 1)
    }

    this.days = days
    this.months = monthOrder.map((key) => {
      const { label, count } = monthCount.get(key)!
      return { key, label, width: count * this.dayWidth }
    })
    this.weeks = buildWeeks(days, this.dayWidth, adapter)
  }

  get totalDays(): number {
    return this.days.length
  }

  /** Total pixel width of the timeline. */
  get width(): number {
    return this.totalDays * this.dayWidth
  }

  /** Pixel x of the left edge of `date`'s day column. */
  dateToX(date: Date): number {
    const dayIndex = Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        - Date.UTC(this.start.getFullYear(), this.start.getMonth(), this.start.getDate()))
      / 86_400_000,
    )
    return dayIndex * this.dayWidth
  }

  /** Day index (whole days from `start`) for a pixel x. */
  xToDayIndex(x: number): number {
    return Math.floor(x / this.dayWidth)
  }
}

function buildWeeks(days: DayCell[], dayWidth: number, adapter: DateAdapter): WeekCell[] {
  const weeks: WeekCell[] = []
  let bucket: DayCell[] = []
  let currentWeek = -1

  const flush = () => {
    if (bucket.length === 0)
      return
    const first = bucket[0]!
    const last = bucket[bucket.length - 1]!
    weeks.push({
      key: `week-${first.key}`,
      label: `W${currentWeek}`,
      range: `${adapter.monthShort(first.date).toLowerCase()} ${first.dayOfMonth}-${last.dayOfMonth}`,
      isoWeek: currentWeek,
      width: bucket.length * dayWidth,
    })
  }

  for (const day of days) {
    if (day.isoWeek !== currentWeek) {
      flush()
      bucket = [day]
      currentWeek = day.isoWeek
    }
    else {
      bucket.push(day)
    }
  }
  flush()
  return weeks
}
