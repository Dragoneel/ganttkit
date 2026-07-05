import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createBaseline } from '../src/index'

function makeRows(): GanttRow[] {
  return [
    { id: 'r1', name: 'R1', tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-05' }] },
    { id: 'r2', name: 'M', tasks: [{ id: 'm', name: 'M', start: '2026-01-03', end: '2026-01-03', kind: 'milestone' }] },
  ]
}

const baselineLayer = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'baseline')
const ghost = (g: GanttEngine, id: string) => baselineLayer(g)?.primitives.find(p => p.key === `baseline-${id}`) as { x: number, width: number } | undefined

describe('createBaseline', () => {
  it('draws a ghost bar at the planned position', () => {
    const g = new GanttEngine({ rows: makeRows(), startDate: '2026-01-01', endDate: '2026-01-31', dayWidth: 60 })
    const baseline = createBaseline({ a: { start: '2026-01-01', end: '2026-01-05' } })
    g.use(baseline.plugin)
    const ga = ghost(g, 'a')!
    expect(ga.x).toBe(0)
    expect(ga.width).toBe(5 * 60)
  })

  it('captures current dates, then shows slip after a move', () => {
    const g = new GanttEngine({ rows: makeRows(), startDate: '2026-01-01', endDate: '2026-01-31', dayWidth: 60 })
    const baseline = createBaseline()
    g.use(baseline.plugin)
    baseline.capture()
    expect(ghost(g, 'a')!.x).toBe(0)

    g.updateTaskDates('a', '2026-01-06', '2026-01-10') // slip 5 days
    // ghost stays at the captured position while the bar moved right
    expect(ghost(g, 'a')!.x).toBe(0)
    const bar = g.getScene().layers.find(l => l.name === 'bars')!.primitives.find(p => p.key === 'bar-a') as { x: number }
    expect(bar.x).toBe(5 * 60)
  })

  it('ignores milestones and clears', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const baseline = createBaseline()
    g.use(baseline.plugin)
    baseline.capture()
    expect(ghost(g, 'm')).toBeUndefined()
    baseline.clear()
    expect(baselineLayer(g)).toBeUndefined()
  })
})
