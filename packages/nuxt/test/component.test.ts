import { describe, expect, it } from 'vitest'
import { GanttChart as VueGanttChart } from '@ganttkit/vue'
import NuxtGanttChart from '../src/runtime/components/GanttChart'
import { defaults as fixtureDefaults, renderer as fixtureRenderer } from './fixtures/ganttkit-options'

interface PropDef { type?: unknown, default?: unknown }

function propsOf(component: unknown): Record<string, PropDef> {
  return (component as { props: Record<string, PropDef> }).props
}

/** Call a Vue prop default the way Vue would for a non-`Function` prop. */
function defaultValue(component: unknown, prop: string): unknown {
  const def = propsOf(component)[prop]?.default
  return typeof def === 'function' ? (def as () => unknown)() : def
}

describe('the auto-imported chart component', () => {
  // The wrapper exists only to inject `nuxt.config`, so its prop surface has to
  // stay the binding's. If this fails, `@ganttkit/vue` grew or lost a prop and
  // this component needs the same edit - otherwise a Nuxt app silently cannot
  // reach it.
  it('mirrors the prop surface of @ganttkit/vue', () => {
    expect(Object.keys(propsOf(NuxtGanttChart)).sort())
      .toEqual(Object.keys(propsOf(VueGanttChart)).sort())
  })

  it('turns every configured default into a prop default', () => {
    expect(defaultValue(NuxtGanttChart, 'viewMode')).toBe(fixtureDefaults.viewMode)
    expect(defaultValue(NuxtGanttChart, 'theme')).toBe(fixtureDefaults.theme)
    expect(defaultValue(NuxtGanttChart, 'dayWidth')).toBe(fixtureDefaults.dayWidth)
    expect(defaultValue(NuxtGanttChart, 'rowHeight')).toBe(fixtureDefaults.rowHeight)
  })

  // An option the config does not mention has to arrive as `undefined`, which
  // is what lets the engine's own default win instead of this layer inventing
  // one.
  it('leaves an unconfigured option undefined', () => {
    expect(fixtureDefaults.barPadding).toBeUndefined()
    expect(defaultValue(NuxtGanttChart, 'barPadding')).toBeUndefined()
    expect(defaultValue(NuxtGanttChart, 'virtualize')).toBeUndefined()
  })

  // Vue hands a `Function`-typed prop its `default` as the value rather than
  // calling it as a factory. A getter here would make every chart's renderer
  // `() => renderer` and paint nothing.
  it('defaults `renderer` to the factory itself, not a getter for it', () => {
    expect(propsOf(NuxtGanttChart).renderer?.default).toBe(fixtureRenderer)
  })

  it('keeps the options the config cannot carry per-chart', () => {
    for (const prop of ['dateAdapter', 'chevron', 'plugins'])
      expect(propsOf(NuxtGanttChart)[prop]?.default).toBeUndefined()
    expect(defaultValue(NuxtGanttChart, 'rows')).toEqual([])
  })

  // How events and attributes reach the binding: no `emits` are declared, so
  // every `@task-click`-style listener lands in `attrs` and is forwarded with
  // them - and `inheritAttrs: false` keeps Vue from also applying them to the
  // wrapper's only root, which is the binding itself.
  it('forwards listeners and attributes rather than redeclaring them', () => {
    const component = NuxtGanttChart as { emits?: unknown, inheritAttrs?: boolean }
    expect(component.emits).toBeUndefined()
    expect(component.inheritAttrs).toBe(false)
  })
})
