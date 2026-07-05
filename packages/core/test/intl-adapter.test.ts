import { describe, expect, it } from 'vitest'
import { createIntlAdapter } from '../src/time/intl-adapter'
import { GanttEngine } from '../src/gantt'
import type { GanttRow } from '../src/types'

describe('createIntlAdapter', () => {
  it('localises weekday and month names', () => {
    const fr = createIntlAdapter('fr-FR')
    const jan = new Date(2026, 0, 15) // Thursday, January
    // French month abbreviation for January is "janv." (locale-dependent).
    expect(fr.monthShort(jan).toLowerCase()).toContain('janv')
    expect(fr.monthLabel(jan)).toContain('2026')
    // weekday name differs from the English default.
    expect(fr.weekdayShort(jan)).not.toBe('Thu')
  })

  it('honours an explicit week start', () => {
    const sun = createIntlAdapter('en-US', { weekStartsOn: 0 })
    // 2026-01-15 is a Thursday → start of week (Sunday) is 2026-01-11.
    expect(sun.toKey(sun.startOfWeek(new Date(2026, 0, 15)))).toBe('2026-01-11')
    const mon = createIntlAdapter('en-GB', { weekStartsOn: 1 })
    expect(mon.toKey(mon.startOfWeek(new Date(2026, 0, 15)))).toBe('2026-01-12')
  })

  it('reuses zero-dependency date math', () => {
    const a = createIntlAdapter('de-DE')
    expect(a.diffDays(new Date(2026, 0, 1), new Date(2026, 0, 11))).toBe(10)
    expect(a.toKey(a.addDays(new Date(2026, 0, 1), 5))).toBe('2026-01-06')
  })
})

describe('engine.setDateAdapter', () => {
  it('swaps the adapter and rebuilds the timescale labels', () => {
    const rows: GanttRow[] = [{ id: 'r', name: 'r', tasks: [{ id: 't', name: 't', start: '2026-01-05', end: '2026-01-09' }] }]
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31' })
    const enMonth = g.getTimeScale().months[0]!.label

    g.setDateAdapter(createIntlAdapter('fr-FR'))
    const frMonth = g.getTimeScale().months[0]!.label
    expect(frMonth).not.toBe(enMonth)
    expect(frMonth).toContain('2026')
  })
})
