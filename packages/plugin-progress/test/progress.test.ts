import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { progressPlugin } from '../src/index'

const rows: GanttRow[] = [
  { id: 'r1', name: 'R1', tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-10', progress: 0.5 }] },
  { id: 'r2', name: 'R2', tasks: [{ id: 'b', name: 'B', start: '2026-01-01', end: '2026-01-10' }] },
  { id: 'r3', name: 'M', tasks: [{ id: 'm', name: 'M', start: '2026-01-05', end: '2026-01-05', kind: 'milestone', progress: 1 }] },
]

const progressLayer = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'progress')

describe('progressPlugin', () => {
  it('adds a fill rect sized to the progress ratio', () => {
    const g = new GanttEngine({ rows }).use(progressPlugin())
    const layer = progressLayer(g)!
    expect(layer).toBeDefined()
    const bar = g.getScene().layers.find(l => l.name === 'bars')!.primitives.find(p => p.key === 'bar-a') as { width: number }
    const fill = layer.primitives.find(p => p.key === 'progress-a') as { width: number }
    expect(fill.width).toBeCloseTo(bar.width * 0.5)
  })

  it('skips tasks without progress and milestones', () => {
    const g = new GanttEngine({ rows }).use(progressPlugin())
    const keys = progressLayer(g)!.primitives.map(p => p.key)
    expect(keys).toContain('progress-a')
    expect(keys).not.toContain('progress-b') // no progress
    expect(keys).not.toContain('progress-m') // milestone
  })

  it('emits no layer when nothing has progress', () => {
    const g = new GanttEngine({ rows: [{ id: 'r', name: 'r', tasks: [{ id: 't', name: 't', start: '2026-01-01', end: '2026-01-02' }] }] }).use(progressPlugin())
    expect(progressLayer(g)).toBeUndefined()
  })
})
