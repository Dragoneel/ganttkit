import { describe, expect, it } from 'vitest'
import { TimeScale, deriveDateRange, effectiveDayWidth } from '../src/time/time-scale'
import { defaultDateAdapter as adapter } from '../src/time/date-adapter'
import type { GanttRow } from '../src/types'

const today = new Date(2026, 5, 27) // 2026-06-27

describe('effectiveDayWidth', () => {
  it('scales per view mode', () => {
    expect(effectiveDayWidth(60, 'Week')).toBe(60)
    expect(effectiveDayWidth(60, 'Day')).toBe(90)
    expect(effectiveDayWidth(60, 'Month')).toBe(30)
  })
})

describe('deriveDateRange', () => {
  const rows: GanttRow[] = [
    { id: 'r1', name: 'Row 1', tasks: [{ id: 't1', name: 'A', start: '2026-03-10', end: '2026-03-20' }] },
    { id: 'r2', name: 'Row 2', tasks: [{ id: 't2', name: 'B', start: '2026-04-05', end: '2026-04-25' }] },
  ]

  it('pads task span to whole months', () => {
    const { start, end } = deriveDateRange(rows, null, null, adapter, today)
    expect(adapter.toKey(start)).toBe('2026-03-01')
    expect(adapter.toKey(end)).toBe('2026-04-30')
  })

  it('respects explicit start/end', () => {
    const { start, end } = deriveDateRange(rows, new Date(2026, 0, 1), new Date(2026, 0, 31), adapter, today)
    expect(adapter.toKey(start)).toBe('2026-01-01')
    expect(adapter.toKey(end)).toBe('2026-01-31')
  })

  it('falls back to current quarter when no tasks', () => {
    const { start, end } = deriveDateRange([], null, null, adapter, today)
    expect(adapter.toKey(start)).toBe('2026-06-01')
    expect(end.getMonth()).toBe(7) // current month + next two → end of August
  })
})

describe('timeScale', () => {
  const scale = new TimeScale({
    start: new Date(2026, 0, 1),
    end: new Date(2026, 0, 31),
    viewMode: 'Week',
    baseDayWidth: 60,
    adapter,
    today,
  })

  it('generates one cell per day', () => {
    expect(scale.totalDays).toBe(31)
    expect(scale.width).toBe(31 * 60)
  })

  it('maps dates to x at day granularity', () => {
    expect(scale.dateToX(new Date(2026, 0, 1))).toBe(0)
    expect(scale.dateToX(new Date(2026, 0, 2))).toBe(60)
    expect(scale.dateToX(new Date(2026, 0, 11))).toBe(600)
  })

  it('flags weekends', () => {
    // 2026-01-03 is a Saturday
    const sat = scale.days.find(d => d.key === '2026-01-03')
    expect(sat?.isWeekend).toBe(true)
  })

  it('builds month and week bands covering the full width', () => {
    const monthWidth = scale.months.reduce((s, m) => s + m.width, 0)
    const weekWidth = scale.weeks.reduce((s, w) => s + w.width, 0)
    expect(monthWidth).toBe(scale.width)
    expect(weekWidth).toBe(scale.width)
  })
})
