import { describe, expect, it, vi } from 'vitest'
import { GanttEngine } from '../src/gantt'
import { TimeScale } from '../src/time/time-scale'
import { resolveWindow } from '../src/scene/viewport'
import { defaultDateAdapter as adapter } from '../src/time/date-adapter'
import type { GanttRow } from '../src/types'

function makeRows(n: number): GanttRow[] {
  return Array.from({ length: n }, (_, r) => ({
    id: `R${r}`,
    name: `Row ${r}`,
    tasks: [{ id: `t${r}`, name: `Task ${r}`, start: '2026-01-02', end: '2026-01-04' }],
  }))
}

const barCount = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'bars')!.primitives.length
const barKeys = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'bars')!.primitives.map(p => p.key)

describe('resolveWindow', () => {
  const scale = new TimeScale({
    start: new Date(2026, 0, 1),
    end: new Date(2026, 11, 31),
    viewMode: 'Week',
    baseDayWidth: 60,
    adapter,
    today: new Date(2026, 0, 1),
  })

  it('clamps to the dataset and applies overscan', () => {
    const win = resolveWindow(
      { scrollTop: 0, scrollLeft: 0, width: 600, height: 200 },
      scale,
      { rowCount: 100, rowHeight: 50, overscanRows: 4, overscanCols: 6 },
    )
    expect(win.rowStart).toBe(0) // floor(0/50) - 4, clamped to 0
    expect(win.rowEnd).toBe(8) // ceil(200/50) + 4
    expect(win.dayStart).toBe(0)
  })

  it('offsets the row window when scrolled', () => {
    const win = resolveWindow(
      { scrollTop: 2500, scrollLeft: 0, width: 600, height: 200 },
      scale,
      { rowCount: 100, rowHeight: 50, overscanRows: 4, overscanCols: 6 },
    )
    expect(win.rowStart).toBe(46) // floor(2500/50) - 4
    expect(win.rowEnd).toBe(58) // ceil(2700/50) + 4
  })
})

describe('engine virtualization', () => {
  it('renders the full scene until a viewport is set', () => {
    const g = new GanttEngine({ rows: makeRows(100), rowHeight: 50 })
    expect(barCount(g)).toBe(100)
    expect(g.getWindow()).toBeNull()
  })

  it('windows the scene to the viewport, keeping full canvas size', () => {
    const g = new GanttEngine({ rows: makeRows(100), rowHeight: 50 })
    const fullHeight = g.getScene().height
    g.setViewport({ scrollTop: 0, scrollLeft: 0, width: 1000, height: 200 })

    expect(barCount(g)).toBeLessThan(20) // ~8 rows + overscan, not 100
    expect(barCount(g)).toBeGreaterThan(0)
    expect(g.getScene().height).toBe(fullHeight) // canvas unchanged → scrollbars correct
    expect(g.getWindow()).not.toBeNull()
  })

  it('moves the window on scroll without recompute', () => {
    const g = new GanttEngine({ rows: makeRows(100), rowHeight: 50 })
    g.setViewport({ scrollTop: 0, scrollLeft: 0, width: 1000, height: 200 })
    expect(barKeys(g)).toContain('bar-t0')

    g.setViewport({ scrollTop: 2500, scrollLeft: 0, width: 1000, height: 200 })
    expect(barKeys(g)).toContain('bar-t50')
    expect(barKeys(g)).not.toContain('bar-t0')
  })

  it('emits scene:change with the right reason', () => {
    const g = new GanttEngine({ rows: makeRows(20), rowHeight: 50 })
    const reasons: string[] = []
    g.events.on('scene:change', ({ reason }) => reasons.push(reason))
    g.setViewport({ scrollTop: 100, scrollLeft: 0, width: 1000, height: 200 })
    g.setRows(makeRows(20))
    expect(reasons).toContain('viewport')
    expect(reasons).toContain('data')
  })

  it('can be disabled via virtualize: false', () => {
    const g = new GanttEngine({ rows: makeRows(100), rowHeight: 50, virtualize: false })
    g.setViewport({ scrollTop: 0, scrollLeft: 0, width: 1000, height: 200 })
    expect(barCount(g)).toBe(100)
    expect(g.getWindow()).toBeNull()
  })
})

describe('drag preview', () => {
  it('shifts the previewed task then restores on clear', () => {
    const g = new GanttEngine({ rows: makeRows(5), rowHeight: 50 })
    const xOf = (id: string) => g.getScene().layers.find(l => l.name === 'bars')!.primitives.find(p => p.key === `bar-${id}`) as { x: number }

    const before = xOf('t0').x
    g.setDragPreview('t0', '2026-01-12', '2026-01-14')
    expect(xOf('t0').x).toBeGreaterThan(before)

    g.clearDragPreview()
    expect(xOf('t0').x).toBe(before)
  })

  it('does not mutate committed rows', () => {
    const g = new GanttEngine({ rows: makeRows(5) })
    g.setDragPreview('t0', '2026-02-01', '2026-02-03')
    expect(g.getRows()[0]!.tasks[0]!.start).toBe('2026-01-02')
  })
})
