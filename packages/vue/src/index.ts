/**
 * @ganttkit/vue - Vue 3 bindings for GanttKit.
 *
 * A thin component over `@ganttkit/html`: the engine and the DOM renderer do
 * all the work, and this package only binds them to Vue's lifecycle and
 * reactivity, so every feature plugin works unchanged.
 *
 * ```vue
 * <script setup lang="ts">
 * import { GanttChart } from '@ganttkit/vue'
 * import '@ganttkit/vue/styles.css'
 * </script>
 *
 * <template>
 *   <GanttChart :rows="rows" view-mode="Week" style="height: 70vh" />
 * </template>
 * ```
 */
export { GanttChart } from './gantt-chart'
export { useGantt } from './use-gantt'
export type { UseGanttHooks, UseGanttReturn } from './use-gantt'
export { createEngine } from './engine'
export type { GanttChartOptions } from './engine'
