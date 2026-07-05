import { describe, expect, it } from 'vitest'
import { TimeScale } from '../src/time/time-scale'
import { defaultDateAdapter as adapter } from '../src/time/date-adapter'
import { computeTaskLayouts } from '../src/layout/layout-engine'
import { computeDependencyLinks } from '../src/layout/dependencies'
import type { GanttRow } from '../src/types'

const today = new Date(2026, 0, 1)
const scale = new TimeScale({
  start: new Date(2026, 0, 1),
  end: new Date(2026, 0, 31),
  viewMode: 'Week',
  baseDayWidth: 60,
  adapter,
  today,
})

const rows: GanttRow[] = [
  { id: 'r1', name: 'R1', tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-05' }] },
  { id: 'r2', name: 'R2', tasks: [{ id: 'b', name: 'B', start: '2026-01-10', end: '2026-01-10', dependencies: ['a'] }] },
  { id: 'r3', name: 'M', tasks: [{ id: 'm', name: 'Mile', start: '2026-01-15', end: '2026-01-15', kind: 'milestone' }] },
]

describe('computeTaskLayouts', () => {
  const layouts = computeTaskLayouts(rows, scale, 50, 6, adapter)

  it('places bars with inclusive width', () => {
    const a = layouts.find(l => l.task.id === 'a')!
    expect(a.x).toBe(0)
    expect(a.width).toBe(5 * 60) // 5 inclusive days
    expect(a.height).toBe(50 - 12)
  })

  it('gives a same-day task a one-day width', () => {
    const b = layouts.find(l => l.task.id === 'b')!
    expect(b.width).toBe(60)
    expect(b.x).toBe(9 * 60)
  })

  it('flags milestones', () => {
    expect(layouts.find(l => l.task.id === 'm')!.isMilestone).toBe(true)
  })

  it('skips tasks with invalid dates', () => {
    const bad: GanttRow[] = [{ id: 'x', name: 'X', tasks: [{ id: 'q', name: 'Q', start: 'nope', end: 'nope' }] }]
    const invalid: string[] = []
    const out = computeTaskLayouts(bad, scale, 50, 6, adapter, t => invalid.push(t.id))
    expect(out).toHaveLength(0)
    expect(invalid).toEqual(['q'])
  })
})

describe('computeDependencyLinks', () => {
  it('links source end to target start', () => {
    const layouts = computeTaskLayouts(rows, scale, 50, 6, adapter)
    const links = computeDependencyLinks(layouts)
    expect(links).toHaveLength(1)
    const link = links[0]!
    expect(link.sourceTaskId).toBe('a')
    expect(link.targetTaskId).toBe('b')
    expect(link.x1).toBe(5 * 60) // end of A
    expect(link.x2).toBe(9 * 60) // start of B
  })
})

