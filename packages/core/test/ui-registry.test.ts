import { describe, expect, it, vi } from 'vitest'
import { UiRegistry } from '../src/plugin/ui-registry'
import type { UiMountContext } from '../src/plugin/ui-registry'

const noop = (_ctx: UiMountContext) => {}

describe('UiRegistry', () => {
  it('lists contributions for a slot sorted by order', () => {
    const ui = new UiRegistry()
    ui.register({ slot: 'toolbar', order: 2, id: 'b', mount: noop })
    ui.register({ slot: 'toolbar', order: 1, id: 'a', mount: noop })
    ui.register({ slot: 'overlay', id: 'c', mount: noop })
    expect(ui.list('toolbar').map(c => c.id)).toEqual(['a', 'b'])
    expect(ui.list('overlay').map(c => c.id)).toEqual(['c'])
    expect(ui.slots().sort()).toEqual(['overlay', 'toolbar'])
  })

  it('notifies subscribers on register and dispose', () => {
    const ui = new UiRegistry()
    const spy = vi.fn()
    ui.subscribe(spy)
    const off = ui.register({ slot: 'toolbar', mount: noop })
    expect(spy).toHaveBeenCalledTimes(1)
    off()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(ui.list('toolbar')).toHaveLength(0)
  })
})
