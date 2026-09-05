import { describe, expect, it } from 'vitest'
import type { GanttPlugin, RendererOptions } from '@ganttkit/core'
import { rebuildKey } from '../src/engine'

const noopRenderer = (_options: RendererOptions): GanttPlugin => ({
  name: 'noop-renderer',
  install: () => undefined,
})

const otherRenderer = (_options: RendererOptions): GanttPlugin => ({
  name: 'other-renderer',
  install: () => undefined,
})

describe('rebuildKey', () => {
  it('is stable for equivalent options', () => {
    expect(rebuildKey({ dayWidth: 40 })).toBe(rebuildKey({ dayWidth: 40 }))
  })

  it('changes when a construction-time option changes', () => {
    expect(rebuildKey({ dayWidth: 40 })).not.toBe(rebuildKey({ dayWidth: 60 }))
  })

  it('ignores the options that sync into the live engine', () => {
    const base = rebuildKey({ dayWidth: 40 })
    expect(rebuildKey({ dayWidth: 40, rows: [{ id: 'r', name: 'R', tasks: [] }] })).toBe(base)
    expect(rebuildKey({ dayWidth: 40, viewMode: 'Month' })).toBe(base)
    expect(rebuildKey({ dayWidth: 40, theme: 'dark' })).toBe(base)
  })

  it('treats equal dates as equal whatever their input form', () => {
    const asDate = rebuildKey({ startDate: new Date('2026-01-01T00:00:00Z') })
    const asNumber = rebuildKey({ startDate: Date.parse('2026-01-01T00:00:00Z') })
    expect(asDate).toBe(asNumber)
  })

  // The renderer is a function, and `JSON.stringify` turns those into `null`.
  // Without an identity id every renderer would hash the same and a swap would
  // leave the previous one painting.
  it('changes when the renderer is swapped', () => {
    expect(rebuildKey({ renderer: noopRenderer })).not.toBe(rebuildKey({ renderer: otherRenderer }))
    expect(rebuildKey({ renderer: noopRenderer })).not.toBe(rebuildKey({}))
  })

  it('is stable for the same renderer', () => {
    expect(rebuildKey({ renderer: noopRenderer })).toBe(rebuildKey({ renderer: noopRenderer }))
  })
})
