import { type DateAdapter, defaultDateAdapter } from './date-adapter'

export interface IntlAdapterOptions {
  /** First day of the week, `0` (Sunday) … `6` (Saturday). Defaults to the locale. */
  weekStartsOn?: number
  /** Day numbers treated as weekend (`0`–`6`). Defaults to the locale. */
  weekend?: number[]
}

interface WeekInfoLike {
  firstDay?: number
  weekend?: number[]
}

/** Read CLDR week info from `Intl.Locale` where supported (spec is still settling). */
function readWeekInfo(locale: string): WeekInfoLike | null {
  try {
    const loc = new Intl.Locale(locale) as unknown as {
      weekInfo?: WeekInfoLike
      getWeekInfo?: () => WeekInfoLike
    }
    return loc.getWeekInfo?.() ?? loc.weekInfo ?? null
  }
  catch {
    return null
  }
}

/**
 * A locale-aware {@link DateAdapter} built on `Intl.DateTimeFormat`.
 *
 * Reuses the zero-dependency date math from {@link defaultDateAdapter} and only
 * localises the parts that vary by language/region: weekday & month names, the
 * first day of the week, and which days count as the weekend. The latter two are
 * read from the locale (CLDR) when the runtime supports it, and can be
 * overridden explicitly.
 *
 * ```ts
 * new GanttEngine({ dateAdapter: createIntlAdapter('fr-FR') })
 * ```
 */
export function createIntlAdapter(locale: string, options: IntlAdapterOptions = {}): DateAdapter {
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  const monthYearFmt = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' })

  const info = readWeekInfo(locale)
  // CLDR uses 1 (Mon) … 7 (Sun); JS getDay() uses 0 (Sun) … 6 (Sat).
  const weekStartsOn = options.weekStartsOn
    ?? (info?.firstDay != null ? info.firstDay % 7 : 1)
  const weekendSet = new Set(
    options.weekend
    ?? (info?.weekend?.length ? info.weekend.map(d => d % 7) : [0, 6]),
  )

  return {
    ...defaultDateAdapter,
    weekdayShort: date => weekdayFmt.format(date),
    monthShort: date => monthFmt.format(date),
    monthLabel: date => monthYearFmt.format(date),
    startOfWeek(date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const diff = (d.getDay() - weekStartsOn + 7) % 7
      d.setDate(d.getDate() - diff)
      return d
    },
    isWeekend: date => weekendSet.has(date.getDay()),
  }
}
