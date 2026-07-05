import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { SIDEBAR_SERVICE, type SidebarModel, columnValue, createColumns, normalizeColumns } from '../src/index'

const rows: GanttRow[] = [
  { id: 'r1', name: 'Design', level: 0, tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-05', meta: { owner: 'Ana' } }] },
  { id: 'r2', name: 'Build', level: 1, tasks: [{ id: 'b', name: 'B', start: '2026-01-06', end: '2026-01-10' }] },
]

describe('normalizeColumns', () => {
  it('enforces a minimum auto width', () => {
    const cols = normalizeColumns([{ key: 'name', label: 'Name', width: 120 }, { key: 'owner', label: 'Owner' }], 200)
    expect(cols[0]!.width).toBe(120)
    expect(cols[1]!.width).toBe(100)
  })

  it('falls back to a single name column', () => {
    const cols = normalizeColumns([], 200)
    expect(cols).toHaveLength(1)
    expect(cols[0]!.key).toBe('name')
  })
})

describe('columnValue', () => {
  it('prefers a formatter', () => {
    expect(columnValue(rows[0]!, { key: 'name', label: 'N', formatter: r => r.name.toUpperCase() })).toBe('DESIGN')
  })
  it('reads the row key then the first task', () => {
    expect(columnValue(rows[0]!, { key: 'name', label: 'N' })).toBe('Design')
  })
})

describe('createColumns plugin', () => {
  it('publishes a sidebar service the engine can consume', () => {
    const g = new GanttEngine({ rows })
    expect(g.consume(SIDEBAR_SERVICE)).toBeUndefined()

    const columns = createColumns({ columns: [{ key: 'name', label: 'Task' }], sidebarWidth: 200 })
    g.use(columns.plugin)

    const sidebar = g.consume<SidebarModel>(SIDEBAR_SERVICE)
    expect(sidebar).toBeDefined()
    expect(sidebar!.getColumns().map(c => c.key)).toEqual(['name'])
    expect(sidebar!.getCellValue(rows[0]!, 'name')).toBe('Design')
    expect(sidebar!.getRowIndent(rows[1]!)).toBe(16)
  })

  it('updates columns reactively and recomputes the scene', () => {
    const g = new GanttEngine({ rows })
    let scenes = 0
    g.onSceneChange(() => { scenes++ })
    const columns = createColumns({ columns: [{ key: 'name', label: 'Task' }] })
    g.use(columns.plugin)
    const before = scenes
    columns.setColumns([{ key: 'name', label: 'Name' }, { key: 'owner', label: 'Owner' }])
    expect(scenes).toBeGreaterThan(before)
    expect(g.consume<SidebarModel>(SIDEBAR_SERVICE)!.getColumns()).toHaveLength(2)
  })

  it('removes the service when uninstalled', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns()
    g.use(columns.plugin)
    expect(g.consume(SIDEBAR_SERVICE)).toBeDefined()
    g.removePlugin('columns')
    expect(g.consume(SIDEBAR_SERVICE)).toBeUndefined()
  })
})
