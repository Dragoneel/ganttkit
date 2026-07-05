import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createSelection } from '../src/index'

function makeRows(): GanttRow[] {
  return [
    { id: 'r1', name: 'R1', tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-05' }] },
    { id: 'r2', name: 'R2', tasks: [{ id: 'b', name: 'B', start: '2026-01-06', end: '2026-01-10' }] },
  ]
}

const selLayer = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'selection')
function clickTask(g: GanttEngine, id: string, modifier = false) {
  const row = g.getRows().find(r => r.tasks.some(t => t.id === id))!
  const task = row.tasks.find(t => t.id === id)!
  g.events.emit('task:click', { task, row, originalEvent: { ctrlKey: modifier } as unknown as Event })
}

describe('createSelection', () => {
  it('selects on click and highlights in the scene', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const selection = createSelection()
    g.use(selection.plugin)
    expect(selLayer(g)).toBeUndefined()

    clickTask(g, 'a')
    expect(selection.getSelected()).toEqual(['a'])
    expect(selLayer(g)!.primitives.map(p => p.key)).toEqual(['sel-a'])
  })

  it('replaces selection on plain click, extends with a modifier', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const selection = createSelection()
    g.use(selection.plugin)
    clickTask(g, 'a')
    clickTask(g, 'b') // plain → replace
    expect(selection.getSelected()).toEqual(['b'])
    clickTask(g, 'a', true) // ctrl → add
    expect(selection.getSelected().sort()).toEqual(['a', 'b'])
    clickTask(g, 'a', true) // ctrl again → toggle off
    expect(selection.getSelected()).toEqual(['b'])
  })

  it('clears selection', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const selection = createSelection()
    g.use(selection.plugin)
    clickTask(g, 'a')
    selection.clear()
    expect(selection.getSelected()).toEqual([])
    expect(selLayer(g)).toBeUndefined()
  })

  it('respects multi: false', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const selection = createSelection({ multi: false })
    g.use(selection.plugin)
    clickTask(g, 'a', true) // modifier ignored
    clickTask(g, 'b', true)
    expect(selection.getSelected()).toEqual(['b'])
  })
})
