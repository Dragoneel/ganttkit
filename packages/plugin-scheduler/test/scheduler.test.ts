import type { GanttTask } from '@ganttkit/core'
import { describe, expect, it, vi } from 'vitest'
import type { Resource } from '../src/index'
import { ASSIGNMENT_TASK_PREFIX, RESOURCE_ROW_PREFIX, assignmentIdFromTaskId, createScheduler, isResourceAvailable } from '../src/index'

const tasks: GanttTask[] = [
  { id: 't1', name: 'Design', start: '2026-07-01', end: '2026-07-03' },
  { id: 't2', name: 'Build', start: '2026-07-04', end: '2026-07-06' },
]
const resources = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
]

describe('createScheduler pivot', () => {
  it('produces one lane per resource, with assignments as bars', () => {
    const s = createScheduler({
      resources,
      tasks,
      assignments: [
        { id: 'x1', taskId: 't1', resourceId: 'alice', start: '2026-07-01', end: '2026-07-01' },
        { id: 'x2', taskId: 't2', resourceId: 'alice', start: '2026-07-02', end: '2026-07-02' },
      ],
    })
    const rows = s.resourceRows()
    expect(rows.map(r => r.id)).toEqual([`${RESOURCE_ROW_PREFIX}alice`, `${RESOURCE_ROW_PREFIX}bob`])
    // Alice works day 1 on t1, day 2 on t2 — two bars in one lane.
    expect(rows[0]!.tasks).toHaveLength(2)
    expect(rows[0]!.meta?.resourceId).toBe('alice')
    expect(rows[1]!.tasks).toHaveLength(0)
    // Bars carry the assignment id (prefixed) and the source task id in meta.
    expect(rows[0]!.tasks[0]!.id).toBe(`${ASSIGNMENT_TASK_PREFIX}x1`)
    expect(rows[0]!.tasks[0]!.meta).toMatchObject({ assignmentId: 'x1', taskId: 't1', resourceId: 'alice' })
    expect(rows[0]!.tasks[0]!.name).toBe('Design')
  })

  it('lets the same task span multiple resource lanes (multi-resource task)', () => {
    const s = createScheduler({
      resources,
      tasks,
      assignments: [
        { id: 'x1', taskId: 't1', resourceId: 'alice', start: '2026-07-01', end: '2026-07-03' },
        { id: 'x2', taskId: 't1', resourceId: 'bob', start: '2026-07-01', end: '2026-07-03' },
      ],
    })
    expect(s.assignmentsForTask('t1')).toHaveLength(2)
    const rows = s.resourceRows()
    expect(rows[0]!.tasks[0]!.meta?.taskId).toBe('t1')
    expect(rows[1]!.tasks[0]!.meta?.taskId).toBe('t1')
  })
})

describe('assignment CRUD + subscribe', () => {
  it('adds, updates, removes and notifies subscribers', () => {
    const s = createScheduler({ resources, tasks })
    const listener = vi.fn()
    s.subscribe(listener)

    const a = s.addAssignment({ taskId: 't1', resourceId: 'alice', start: '2026-07-01', end: '2026-07-01' })
    expect(a.id).toBeTruthy()
    expect(s.getAssignments()).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)

    const updated = s.updateAssignment(a.id, { resourceId: 'bob' })
    expect(updated?.resourceId).toBe('bob')
    expect(s.assignmentsForResource('bob')).toHaveLength(1)
    expect(s.assignmentsForResource('alice')).toHaveLength(0)

    s.removeAssignment(a.id)
    expect(s.getAssignments()).toHaveLength(0)
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('generates stable, unique ids by default', () => {
    const s = createScheduler({ resources, tasks })
    const a = s.addAssignment({ taskId: 't1', resourceId: 'alice', start: '2026-07-01', end: '2026-07-01' })
    const b = s.addAssignment({ taskId: 't2', resourceId: 'bob', start: '2026-07-04', end: '2026-07-04' })
    expect(a.id).not.toBe(b.id)
  })
})

describe('isResourceAvailable', () => {
  // 2026-07-06 is a Monday; 07-11 Sat, 07-12 Sun.
  it('respects the working-day pattern', () => {
    const r: Resource = { id: 'r', name: 'R', workingDays: ['Mo', 'Tu', 'We', 'Th', 'Fr'] }
    expect(isResourceAvailable(r, '2026-07-06')).toBe(true) // Mon
    expect(isResourceAvailable(r, '2026-07-11')).toBe(false) // Sat
    expect(isResourceAvailable(r, '2026-07-12')).toBe(false) // Sun
  })

  it('treats disabled dates as unavailable even on a working weekday', () => {
    const r = { id: 'r', name: 'R', unavailableDates: ['2026-07-06'] }
    expect(isResourceAvailable(r, '2026-07-06')).toBe(false) // Mon but off
    expect(isResourceAvailable(r, '2026-07-07')).toBe(true) // Tue
  })

  it('defaults to Mon–Fri when no pattern is given', () => {
    const r = { id: 'r', name: 'R' }
    expect(isResourceAvailable(r, '2026-07-06')).toBe(true)
    expect(isResourceAvailable(r, '2026-07-11')).toBe(false)
  })
})

describe('assignmentIdFromTaskId', () => {
  it('unwraps prefixed bar ids and rejects others', () => {
    expect(assignmentIdFromTaskId(`${ASSIGNMENT_TASK_PREFIX}x1`)).toBe('x1')
    expect(assignmentIdFromTaskId('t1')).toBeNull()
  })
})
