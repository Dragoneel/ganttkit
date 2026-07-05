import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { createMarkers } from '../src/index'

const rows: GanttRow[] = [
  { id: 'r1', name: 'R1', tasks: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-31' }] },
]
const markersLayer = (g: GanttEngine) => g.getScene().layers.find(l => l.name === 'markers')

describe('createMarkers', () => {
  it('draws a line at the marker date', () => {
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31', dayWidth: 60 })
    g.use(createMarkers([{ id: 'd', date: '2026-01-11' }]).plugin)
    const line = markersLayer(g)!.primitives.find(p => p.key === 'd') as { type: string, x1: number }
    expect(line.type).toBe('line')
    expect(line.x1).toBe(10 * 60) // 10 days from Jan 1 at 60px/day (Week view)
  })

  it('draws a band with a label', () => {
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31', dayWidth: 60 })
    g.use(createMarkers([{ id: 's', date: '2026-01-06', end: '2026-01-10', label: 'Sprint' }]).plugin)
    const prims = markersLayer(g)!.primitives
    const band = prims.find(p => p.key === 's-band') as { type: string, x: number, width: number }
    expect(band.type).toBe('rect')
    expect(band.x).toBe(5 * 60)
    expect(band.width).toBe(5 * 60) // 6th–10th inclusive = 5 days
    expect(prims.find(p => p.key === 's-label')).toBeDefined()
  })

  it('updates reactively', () => {
    const g = new GanttEngine({ rows })
    const markers = createMarkers()
    g.use(markers.plugin)
    expect(markersLayer(g)).toBeUndefined()
    markers.addMarker({ id: 'x', date: '2026-01-10' })
    expect(markersLayer(g)!.primitives.some(p => p.key === 'x')).toBe(true)
    markers.clearMarkers()
    expect(markersLayer(g)).toBeUndefined()
  })
})
