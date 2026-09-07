import { describe, expect, it } from 'vitest'
import { mergeChartOptions } from '../src/runtime/defaults'

describe('mergeChartOptions', () => {
  it('layers the config under the call-site options', () => {
    expect(mergeChartOptions({ dayWidth: 36, theme: 'dark' }, { theme: 'light' }))
      .toEqual({ dayWidth: 36, theme: 'light' })
  })

  // Vue hands absent props through as `undefined`, and a caller spreading a
  // partially-filled object does the same. Letting those through would mean
  // every call site had to strip its own empty keys to keep the config.
  it('reads an explicit undefined as "not set", not as "clear it"', () => {
    expect(mergeChartOptions({ dayWidth: 36 }, { dayWidth: undefined }))
      .toEqual({ dayWidth: 36 })
  })

  it('keeps a falsy override, which is a real value', () => {
    expect(mergeChartOptions({ highlightToday: true }, { highlightToday: false }))
      .toEqual({ highlightToday: false })
    expect(mergeChartOptions({ dayWidth: 36 }, { dayWidth: 0 }))
      .toEqual({ dayWidth: 0 })
  })

  it('passes through options the config has no say over', () => {
    const rows = [{ id: 'r', name: 'R', tasks: [] }]
    expect(mergeChartOptions({ dayWidth: 36 }, { rows })).toEqual({ dayWidth: 36, rows })
  })

  it('does not mutate either input', () => {
    const defaults = Object.freeze({ dayWidth: 36 })
    const options = Object.freeze({ theme: 'light' as const })
    mergeChartOptions(defaults, options)
    expect(defaults).toEqual({ dayWidth: 36 })
    expect(options).toEqual({ theme: 'light' })
  })
})
