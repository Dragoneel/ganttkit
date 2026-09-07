import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import ganttkitModule from '../src/module'

/** Enough of a Nuxt instance for `getOptions` to resolve the defaults. */
const fakeNuxt = { options: {} } as unknown as Nuxt

describe('module meta', () => {
  it('is named after the package and reads the `ganttkit` config key', async () => {
    const meta = await ganttkitModule.getMeta!()
    expect(meta.name).toBe('@ganttkit/nuxt')
    expect(meta.configKey).toBe('ganttkit')
  })

  // Version-agnostic by policy: the constraint lives here rather than in the
  // module's name or description.
  it('declares its Nuxt compatibility range', async () => {
    const meta = await ganttkitModule.getMeta!()
    expect(meta.compatibility?.nuxt).toBe('>=3.0.0')
  })
})

describe('module defaults', () => {
  it('works with no configuration at all', async () => {
    const options = await ganttkitModule.getOptions!(undefined, fakeNuxt)
    expect(options).toEqual({
      renderer: 'html',
      css: true,
      defaults: {},
      prefix: 'Gantt',
      autoImports: true,
    })
  })

  // Nuxt asks modules to prefix what they inject; the default has to be a real
  // prefix rather than the empty string, so `<GanttChart>` and `useGantt()` are
  // namespaced out of the box.
  it('prefixes what it injects by default', async () => {
    const options = await ganttkitModule.getOptions!(undefined, fakeNuxt)
    expect(options.prefix).toBe('Gantt')
  })

  it('lets a config override reach through', async () => {
    const options = await ganttkitModule.getOptions!({ renderer: 'canvas', css: false }, fakeNuxt)
    expect(options.renderer).toBe('canvas')
    expect(options.css).toBe(false)
    expect(options.prefix).toBe('Gantt')
  })
})
