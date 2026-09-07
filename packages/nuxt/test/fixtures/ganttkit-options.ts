import type { GanttPlugin, RendererOptions } from '@ganttkit/core'
import type { GanttChartDefaults } from '../../src/types'

/**
 * Stand-in for the module `src/module.ts` generates at build time, aliased
 * over `#ganttkit-options` by this package's vitest config.
 *
 * The values are deliberately not the engine's own defaults, so a test can
 * tell "the config was read" apart from "the engine happened to agree".
 */
export const renderer = (_options: RendererOptions): GanttPlugin => ({
  name: 'fixture-renderer',
  install: () => undefined,
})

export const defaults: GanttChartDefaults = Object.freeze({
  viewMode: 'Month',
  theme: 'dark',
  dayWidth: 36,
  rowHeight: 30,
})
