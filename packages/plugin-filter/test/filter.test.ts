import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createFilter, filters } from '../src/index'

function rows(): GanttRow[] {
  return [
    { id: 'r1', name: 'Design', tasks: [{ id: 'a', name: 'API spec', start: '2026-01-01', end: '2026-01-05' }] },
    { id: 'r2', name: 'Build', tasks: [
      { id: 'b', name: 'API impl', start: '2026-01-06', end: '2026-01-10' },
      { id: 'c', name: 'Docs', start: '2026-01-11', end: '2026-01-12' },
    ] },
  ]
}

function barCount(g: GanttEngine): number {
  return g.getScene().layers.find(l => l.name === 'bars')!.primitives.length
}

describe('createFilter', () => {
  it('filters tasks and recomputes the scene', () => {
    const g = new GanttEngine({ rows: rows() })
    const filter = createFilter()
    g.use(filter.plugin)
    expect(barCount(g)).toBe(3)

    filter.setTaskFilter(filters.taskNameIncludes('api'))
    expect(barCount(g)).toBe(2)
    expect(g.getRows().map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('drops emptied rows by default', () => {
    const g = new GanttEngine({ rows: rows() })
    const filter = createFilter()
    g.use(filter.plugin)
    filter.setTaskFilter(filters.taskNameIncludes('docs'))
    expect(g.getRows().map(r => r.id)).toEqual(['r2'])
  })

  it('applies a row filter', () => {
    const g = new GanttEngine({ rows: rows() })
    const filter = createFilter()
    g.use(filter.plugin)
    filter.setRowFilter(filters.rowNameIncludes('design'))
    expect(g.getRows().map(r => r.id)).toEqual(['r1'])
  })

  it('clears via the registered command', () => {
    const g = new GanttEngine({ rows: rows() })
    const filter = createFilter({ task: filters.taskNameIncludes('api') })
    g.use(filter.plugin)
    expect(barCount(g)).toBe(2)
    g.commands.execute('filter.clear')
    expect(barCount(g)).toBe(3)
  })

  it('restores all rows when the plugin is removed', () => {
    const g = new GanttEngine({ rows: rows() })
    const filter = createFilter({ task: filters.taskNameIncludes('api') })
    g.use(filter.plugin)
    expect(barCount(g)).toBe(2)
    g.removePlugin('filter')
    expect(barCount(g)).toBe(3)
  })
})
