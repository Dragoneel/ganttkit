import { describe, expect, it } from 'vitest'
import { beginDrag, dragVisualDelta, resolveDraggedDates, updateDrag } from '../src/interaction/drag'
import { stepViewMode, wheelToViewMode } from '../src/interaction/zoom'
import { defaultDateAdapter as adapter } from '../src/time/date-adapter'
import type { GanttTask } from '../src/types'

const task: GanttTask = { id: 't', name: 'T', start: '2026-01-10', end: '2026-01-15' }

describe('drag', () => {
  it('snaps pixel offset to whole days', () => {
    const drag = updateDrag(beginDrag({ taskId: 't', rowId: 'r', mode: 'move', startX: 0, dayWidth: 60 }), 130)
    expect(drag.offsetDays).toBe(2) // 130 / 60 ≈ 2.17 → 2
  })

  it('move shifts both edges', () => {
    let drag = beginDrag({ taskId: 't', rowId: 'r', mode: 'move', startX: 0, dayWidth: 60 })
    drag = updateDrag(drag, 180) // +3 days
    const { start, end } = resolveDraggedDates(task, drag, adapter)
    expect(adapter.toKey(start)).toBe('2026-01-13')
    expect(adapter.toKey(end)).toBe('2026-01-18')
  })

  it('resize-left clamps so the bar stays >= 1 day', () => {
    let drag = beginDrag({ taskId: 't', rowId: 'r', mode: 'resize-left', startX: 0, dayWidth: 60 })
    drag = updateDrag(drag, 60 * 99) // far past the end
    const { start, end } = resolveDraggedDates(task, drag, adapter)
    expect(start.getTime()).toBe(end.getTime())
  })

  it('exposes visual deltas per mode', () => {
    const base = beginDrag({ taskId: 't', rowId: 'r', mode: 'resize-right', startX: 0, dayWidth: 60 })
    const drag = updateDrag(base, 120)
    expect(dragVisualDelta(drag)).toEqual({ dx: 0, dWidth: 120 })
  })
})

describe('zoom', () => {
  it('steps and clamps view modes', () => {
    expect(stepViewMode('Week', 1)).toBe('Month')
    expect(stepViewMode('Month', 1)).toBe('Month')
    expect(stepViewMode('Day', -1)).toBe('Day')
  })

  it('maps wheel direction to coarser/finer', () => {
    expect(wheelToViewMode('Week', -1)).toBe('Month')
    expect(wheelToViewMode('Week', 1)).toBe('Day')
  })
})
