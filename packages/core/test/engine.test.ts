import { describe, expect, it, vi } from 'vitest'
import { GanttEngine } from '../src/gantt'
import type { GanttPlugin } from '../src/engine-types'
import type { GanttRow } from '../src/types'

function makeRows(): GanttRow[] {
  return [
    { id: 'r1', name: 'Alpha', tasks: [{ id: 'a', name: 'A', start: '2026-01-05', end: '2026-01-10' }] },
    { id: 'r2', name: 'Beta', tasks: [{ id: 'b', name: 'B', start: '2026-01-12', end: '2026-01-20' }] },
  ]
}

describe('GanttEngine', () => {
  it('builds a scene on construction', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const scene = g.getScene()
    expect(scene.layers.find(l => l.name === 'bars')!.primitives).toHaveLength(2)
    expect(scene.width).toBeGreaterThan(0)
  })

  it('emits scene:change when rows change', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const spy = vi.fn()
    g.onSceneChange(spy)
    g.setRows([...makeRows(), { id: 'r3', name: 'Gamma', tasks: [{ id: 'c', name: 'C', start: '2026-01-22', end: '2026-01-25' }] }])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(g.getScene().layers.find(l => l.name === 'bars')!.primitives).toHaveLength(3)
  })

  it('changes geometry with view mode', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const weekWidth = g.getScene().width
    g.setViewMode('Month')
    expect(g.getScene().width).toBeLessThan(weekWidth)
  })

  it('runs the rows hook (filter plugins)', () => {
    const onlyAlpha: GanttPlugin = {
      name: 'only-alpha',
      install(ctx) {
        return ctx.hooks.rows.tap(rows => rows.filter(r => r.name === 'Alpha'))
      },
    }
    const g = new GanttEngine({ rows: makeRows() }).use(onlyAlpha)
    expect(g.getRows()).toHaveLength(1)
    expect(g.getScene().layers.find(l => l.name === 'bars')!.primitives).toHaveLength(1)
  })

  it('disposes plugin taps on removal', () => {
    const plugin: GanttPlugin = {
      name: 'f',
      install: ctx => ctx.hooks.rows.tap(rows => rows.filter(r => r.name === 'Alpha')),
    }
    const g = new GanttEngine({ rows: makeRows() }).use(plugin)
    expect(g.getRows()).toHaveLength(1)
    g.removePlugin('f')
    expect(g.getRows()).toHaveLength(2)
  })

  it('commits dragged dates via updateTaskDates', () => {
    const g = new GanttEngine({ rows: makeRows() })
    expect(g.updateTaskDates('a', '2026-01-08', '2026-01-13')).toBe(true)
    const a = g.getRows()[0]!.tasks[0]!
    expect(a.start).toBe('2026-01-08')
  })

  it('hit-tests a point against the scene', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const bar = g.getScene().layers.find(l => l.name === 'bars')!.primitives[0]!
    if (bar.type !== 'rect')
      throw new Error('expected a rect bar')
    // A point inside the first bar resolves to its task; a far-away point misses.
    const hit = g.hitTest(bar.x + bar.width / 2, bar.y + bar.height / 2)
    expect(hit?.taskId).toBe('a')
    expect(hit?.handle).toBeNull()
    expect(g.hitTest(-100, -100)).toBeNull()
  })

  it('region hit-tests bars for rubber-band selection', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const bars = g.getScene().layers.find(l => l.name === 'bars')!.primitives
      .filter(p => p.type === 'rect') as Array<{ x: number, y: number, width: number, height: number }>
    // A rectangle spanning the full scene covers both bars.
    const all = g.hitTestRegion(0, 0, g.getScene().width, g.getScene().height)
    expect(all.sort()).toEqual(['a', 'b'])
    // A rectangle around only the first bar selects just it.
    const first = bars[0]!
    const just = g.hitTestRegion(first.x - 2, first.y - 2, first.x + 2, first.y + 2)
    expect(just).toEqual(['a'])
    // An empty area selects nothing.
    expect(g.hitTestRegion(-50, -50, -10, -10)).toEqual([])
  })

  it('hit-tests resize handles ahead of the bar body', () => {
    const g = new GanttEngine({ rows: makeRows() })
    const handle = g.getScene().layers.find(l => l.name === 'handles')!.primitives
      .find(p => p.type === 'rect' && p.data?.['task-id'] === 'a' && p.data?.handle === 'left')
    if (!handle || handle.type !== 'rect')
      throw new Error('expected a left handle')
    const hit = g.hitTest(handle.x + handle.width / 2, handle.y + handle.height / 2)
    expect(hit).toEqual({ taskId: 'a', handle: 'left' })
  })

  it('registers and executes plugin commands', () => {
    const plugin: GanttPlugin = {
      name: 'cmd',
      install(ctx) {
        ctx.commands.register('say.hi', (name: string) => `hi ${name}`)
      },
    }
    const g = new GanttEngine().use(plugin)
    expect(g.commands.execute('say.hi', 'gantt')).toBe('hi gantt')
  })
})
