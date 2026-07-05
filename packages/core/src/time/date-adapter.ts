import type { DateInput } from '../types'

/**
 * Pluggable date backend.
 *
 * The engine performs all date math through this interface so consumers can
 * swap in dayjs/luxon/date-fns without the core taking a runtime dependency.
 * The built-in {@link defaultDateAdapter} is zero-dependency.
 *
 * Convention: a "day" is the local calendar day. `startOfDay` pins time to
 * midnight so day-grid math is integer and DST-stable for whole-day ranges.
 */
export interface DateAdapter {
  /** Coerce any accepted input into a `Date`. Throws on invalid input. */
  parse(value: DateInput): Date
  /** Midnight (local) of the given date. */
  startOfDay(date: Date): Date
  /** First day of the month, at midnight. */
  startOfMonth(date: Date): Date
  /** Last day of the month, at midnight. */
  endOfMonth(date: Date): Date
  /** Add `n` whole days (may be negative). */
  addDays(date: Date, n: number): Date
  /** Whole-day difference `b - a` (floored). */
  diffDays(a: Date, b: Date): number
  /** ISO-8601 week number (1–53). */
  isoWeek(date: Date): number
  /** Monday (local, midnight) of the date's week. */
  startOfWeek(date: Date): Date
  /** `true` for Saturday/Sunday. */
  isWeekend(date: Date): boolean
  /** `true` when the two dates fall on the same calendar day. */
  isSameDay(a: Date, b: Date): boolean
  /** `YYYY-MM-DD` key (local). Stable map/keying helper. */
  toKey(date: Date): string
  /** Short weekday name, e.g. `Mon`. */
  weekdayShort(date: Date): string
  /** Short month label, e.g. `Jan 2026`. */
  monthLabel(date: Date): string
  /** Short month name only, e.g. `Jan`. */
  monthShort(date: Date): string
}

const MS_PER_DAY = 86_400_000

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * Default zero-dependency date adapter using the platform `Date`.
 *
 * Locale-independent: weekday/month labels are fixed English abbreviations so
 * output is deterministic across environments. Wrap your own adapter if you
 * need localisation.
 */
export const defaultDateAdapter: DateAdapter = {
  parse(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime()))
        throw new TypeError('GanttKit: invalid Date passed to parse()')
      return new Date(value.getTime())
    }
    const d = new Date(value)
    if (Number.isNaN(d.getTime()))
      throw new TypeError(`GanttKit: cannot parse date from ${JSON.stringify(value)}`)
    return d
  },

  startOfDay(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  },

  startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  },

  endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
  },

  addDays(date, n) {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
  },

  diffDays(a, b) {
    // Normalise to UTC midnight to avoid DST hour drift over the span.
    const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
    const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
    return Math.floor((ub - ua) / MS_PER_DAY)
  },

  isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
  },

  startOfWeek(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday-based
    d.setDate(diff)
    return d
  },

  isWeekend(date) {
    const day = date.getDay()
    return day === 0 || day === 6
  },

  isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    )
  },

  toKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  },

  weekdayShort(date) {
    return WEEKDAYS[date.getDay()]!
  },

  monthLabel(date) {
    return `${MONTHS[date.getMonth()]!} ${date.getFullYear()}`
  },

  monthShort(date) {
    return MONTHS[date.getMonth()]!
  },
}
