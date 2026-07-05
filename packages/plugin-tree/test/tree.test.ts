import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createTree } from '../src/index'

function makeRows(): GanttRow[] {
  return [
    { id: 'design', name: 'Design', tasks: [] },
    { id: 'wf', name: 'Wireframes', parentId: 'design', tasks: [{ id: 't1', name: 'WF', start: '2026-01-01', end: '2026-01-05' }] },
    { id: 'mock', name: 'Mockups', parentId: 'design', tasks: [{ id: 't2', name: 'MK', start: '2026-01-06', end: '2026-01-10' }] },
    { id: 'build', name: 'Build', tasks: [] },
    { id: 'api', name: 'API', parentId: 'build', tasks: [{ id: 't3', name: 'API', start: '2026-01-11', end: '2026-01-20' }] },
  ]
}

const ids = (g: GanttEngine) => g.getRows().map(r => r.id)

describe('createTree', () => {
  it('annotates hasChildren / level / expanded', () => {
    const g = new GanttEngine({ rows: makeRows() }).use(createTree().plugin)
    const design = g.getRows().find(r => r.id === 'design')!
    const wf = g.getRows().find(r => r.id === 'wf')!
    expect(design.hasChildren).toBe(true)
    expect(design.expanded).toBe(true)
    expect(wf.level).toBe(1)
    expect(wf.hasChildren).toBe(false)
  })

  it('hides descendants of collapsed rows', () => {
    const tree = createTree({ collapsed: ['design'] })
    const g = new GanttEngine({ rows: makeRows() }).use(tree.plugin)
    expect(ids(g)).toEqual(['design', 'build', 'api'])
    expect(g.getRows().find(r => r.id === 'design')!.expanded).toBe(false)
  })

  it('toggles via controller and via the row:toggle event', () => {
    const tree = createTree()
    const g = new GanttEngine({ rows: makeRows() }).use(tree.plugin)
    expect(ids(g)).toHaveLength(5)

    tree.collapse('design')
    expect(ids(g)).toEqual(['design', 'build', 'api'])

    g.events.emit('row:toggle', { rowId: 'design' }) // what the renderer chevron emits
    expect(ids(g)).toHaveLength(5)
  })

  it('collapseAll / expandAll', () => {
    const tree = createTree()
    const g = new GanttEngine({ rows: makeRows() }).use(tree.plugin)
    tree.collapseAll()
    expect(ids(g)).toEqual(['design', 'build'])
    tree.expandAll()
    expect(ids(g)).toHaveLength(5)
  })

  it('exposes commands', () => {
    const tree = createTree()
    const g = new GanttEngine({ rows: makeRows() }).use(tree.plugin)
    g.commands.execute('tree.collapse', 'build')
    expect(ids(g)).toEqual(['design', 'wf', 'mock', 'build'])
  })
})
