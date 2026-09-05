/**
 * @ganttkit/react - React 19 bindings for GanttKit.
 *
 * A thin component over `@ganttkit/html`: the engine and the DOM renderer do
 * all the work, and this package only binds them to React's lifecycle, so every
 * feature plugin works unchanged.
 *
 * ```tsx
 * import { GanttChart } from '@ganttkit/react'
 * import '@ganttkit/react/styles.css'
 *
 * <GanttChart rows={rows} viewMode="Week" style={{ height: '70vh' }} />
 * ```
 */
export { GanttChart } from './gantt-chart'
export type { GanttChartHandle, GanttChartProps } from './gantt-chart'
export { useGantt } from './use-gantt'
export type { UseGanttHooks } from './use-gantt'
export { createEngine } from './engine'
export type { GanttChartOptions } from './engine'
