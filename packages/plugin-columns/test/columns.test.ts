import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { SIDEBAR_SERVICE, type SidebarModel, columnValue, createColumns, localStorageWidthStore, normalizeColumns } from '../src/index'

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

  it('defaults the tree column to the first column', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({ columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner' }] })
    g.use(columns.plugin)
    expect(g.consume<SidebarModel>(SIDEBAR_SERVICE)!.getTreeColumnKey()).toBe('name')
  })

  it('honors a configured tree column', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({
      columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner' }],
      treeColumn: 'owner',
    })
    g.use(columns.plugin)
    expect(g.consume<SidebarModel>(SIDEBAR_SERVICE)!.getTreeColumnKey()).toBe('owner')
  })

  it('falls back to the first column when the tree column key is unknown', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({
      columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner' }],
      treeColumn: 'nope',
    })
    g.use(columns.plugin)
    expect(g.consume<SidebarModel>(SIDEBAR_SERVICE)!.getTreeColumnKey()).toBe('name')
  })

  it('updates the tree column reactively', () => {
    const g = new GanttEngine({ rows })
    let scenes = 0
    g.onSceneChange(() => { scenes++ })
    const columns = createColumns({ columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner' }] })
    g.use(columns.plugin)
    const before = scenes
    columns.setTreeColumn('owner')
    expect(scenes).toBeGreaterThan(before)
    expect(g.consume<SidebarModel>(SIDEBAR_SERVICE)!.getTreeColumnKey()).toBe('owner')
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

describe('column resizing', () => {
  it('resizes a column and grows the sidebar width', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({
      columns: [{ key: 'name', label: 'Task', width: 120 }, { key: 'owner', label: 'Owner', width: 80 }],
      sidebarWidth: 200,
    })
    g.use(columns.plugin)
    const sidebar = g.consume<SidebarModel>(SIDEBAR_SERVICE)!
    expect(sidebar.getSidebarWidth()).toBe(200)

    sidebar.setColumnWidth('name', 180)
    expect(sidebar.getColumns().find(c => c.key === 'name')!.width).toBe(180)
    expect(sidebar.getSidebarWidth()).toBe(260) // 180 + 80
  })

  it('clamps to the minimum column width', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({ columns: [{ key: 'name', label: 'Task' }], minColumnWidth: 60 })
    g.use(columns.plugin)
    columns.setColumnWidth('name', 10)
    expect(columns.getColumns()[0]!.width).toBe(60)
  })

  it('honors global and per-column resizable flags', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({
      resizable: false,
      columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner', resizable: true }],
    })
    g.use(columns.plugin)
    const sidebar = g.consume<SidebarModel>(SIDEBAR_SERVICE)!
    expect(sidebar.isColumnResizable('name')).toBe(false)
    expect(sidebar.isColumnResizable('owner')).toBe(true)

    // A non-resizable column ignores width commits.
    sidebar.setColumnWidth('name', 300)
    expect(columns.getColumnWidths().name).toBeUndefined()
  })

  it('resets width overrides', () => {
    const g = new GanttEngine({ rows })
    const columns = createColumns({ columns: [{ key: 'name', label: 'Task', width: 100 }], sidebarWidth: 100 })
    g.use(columns.plugin)
    columns.setColumnWidth('name', 200)
    expect(columns.getColumns()[0]!.width).toBe(200)

    columns.resetColumnWidths()
    expect(columns.getColumns()[0]!.width).toBe(100)
    expect(columns.getColumnWidths()).toEqual({})
  })

  it('persists widths through a custom store and restores them on init', () => {
    let backing: Record<string, number> | null = null
    const store = {
      load: () => backing,
      save: (w: Record<string, number>) => { backing = { ...w } },
    }
    const cols = [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner' }]

    const g1 = new GanttEngine({ rows })
    const c1 = createColumns({ columns: cols, persistWidths: store })
    g1.use(c1.plugin)
    c1.setColumnWidth('owner', 140)
    expect(backing).toEqual({ owner: 140 })

    // A fresh instance sharing the store restores the saved width.
    const g2 = new GanttEngine({ rows })
    const c2 = createColumns({ columns: cols, persistWidths: store })
    g2.use(c2.plugin)
    expect(c2.getColumns().find(c => c.key === 'owner')!.width).toBe(140)
  })

  it('localStorageWidthStore round-trips via a global stub', () => {
    const mem = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v) },
      removeItem: (k: string) => { mem.delete(k) },
    }
    try {
      const store = localStorageWidthStore('gk-widths')
      store.save({ name: 123 })
      expect(store.load()).toEqual({ name: 123 })
    }
    finally {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage
    }
  })
})
