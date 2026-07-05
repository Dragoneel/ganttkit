import { describe, expect, it } from 'vitest'
import { GanttEngine, defaultDateAdapter as adapter } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createDependencies } from '../src/index'

function makeRows(): GanttRow[] {
  return [
    {
      id: 'r',
      name: 'r',
      tasks: [
        { id: 'A', name: 'A', start: '2026-01-01', end: '2026-01-05' },
        { id: 'B', name: 'B', start: '2026-01-03', end: '2026-01-06', dependencies: ['A'] },
        { id: 'C', name: 'C', start: '2026-01-04', end: '2026-01-05', dependencies: ['B'] },
      ],
    },
  ]
}

const task = (g: GanttEngine, id: string) => g.getState().rows[0]!.tasks.find(t => t.id === id)!
const key = (d: unknown) => adapter.toKey(adapter.parse(d as never))

describe('reschedule (finish-to-start)', () => {
  it('pushes dependents past their predecessor and cascades', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const deps = createDependencies({ autoSchedule: false })
    g.use(deps.plugin)

    const count = deps.reschedule()
    expect(count).toBe(2)
    expect(key(task(g, 'B').start)).toBe('2026-01-06') // day after A ends (01-05)
    expect(key(task(g, 'B').end)).toBe('2026-01-09') // duration preserved (4 days)
    expect(key(task(g, 'C').start)).toBe('2026-01-10') // day after B's new end
  })

  it('respects a gap', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const deps = createDependencies({ autoSchedule: false, gap: 2 })
    g.use(deps.plugin)
    deps.reschedule()
    expect(key(task(g, 'B').start)).toBe('2026-01-08') // A ends 01-05 + 1 + gap 2
  })

  it('does not pull tasks earlier than scheduled', () => {
    const rows: GanttRow[] = [{ id: 'r', name: 'r', tasks: [
      { id: 'A', name: 'A', start: '2026-01-01', end: '2026-01-05' },
      { id: 'B', name: 'B', start: '2026-02-01', end: '2026-02-05', dependencies: ['A'] },
    ] }]
    const g = new GanttEngine({ rows })
    const deps = createDependencies({ autoSchedule: false })
    g.use(deps.plugin)
    expect(deps.reschedule()).toBe(0) // B already starts well after A
  })
})

describe('auto-schedule on drag', () => {
  it('shifts dependents when a predecessor moves', () => {
    const g = new GanttEngine({ rows: makeRows() })
    g.use(createDependencies().plugin)
    g.updateTaskDates('A', '2026-01-10', '2026-01-14')
    g.events.emit('task:dragend', { task: task(g, 'A'), row: g.getState().rows[0]!, mode: 'move', start: new Date(), end: new Date(), changed: true })
    expect(key(task(g, 'B').start)).toBe('2026-01-15') // day after A's new end
  })
})

describe('addDependency / removeDependency', () => {
  it('adds a link', () => {
    const rows: GanttRow[] = [{ id: 'r', name: 'r', tasks: [
      { id: 'A', name: 'A', start: '2026-01-01', end: '2026-01-05' },
      { id: 'B', name: 'B', start: '2026-01-10', end: '2026-01-15' },
    ] }]
    const g = new GanttEngine({ rows })
    const deps = createDependencies({ autoSchedule: false })
    g.use(deps.plugin)
    expect(deps.addDependency('A', 'B')).toBe(true)
    expect(task(g, 'B').dependencies).toContain('A')
  })

  it('rejects cycles and self-links', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const deps = createDependencies({ autoSchedule: false })
    g.use(deps.plugin)
    expect(deps.addDependency('A', 'A')).toBe(false)
    // B depends on A; making A depend on B would cycle.
    expect(deps.addDependency('B', 'A')).toBe(false)
  })

  it('removes a link', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const deps = createDependencies({ autoSchedule: false })
    g.use(deps.plugin)
    expect(deps.removeDependency('A', 'B')).toBe(true)
    expect(task(g, 'B').dependencies).not.toContain('A')
  })

  it('exposes commands', () => {
    const g = new GanttEngine({ rows: makeRows() })
    g.use(createDependencies({ autoSchedule: false }).plugin)
    expect(g.commands.execute('deps.reschedule')).toBe(2)
  })
})
