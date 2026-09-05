/**
 * @ganttkit/angular - Angular bindings for GanttKit.
 *
 * A thin standalone component over `@ganttkit/html`: the engine and the DOM
 * renderer do all the work, and this package only binds them to Angular's
 * signals and lifecycle, so every feature plugin works unchanged.
 *
 * ```ts
 * import { GanttChartComponent } from '@ganttkit/angular'
 *
 * @Component({
 *   imports: [GanttChartComponent],
 *   template: `<gantt-chart [rows]="rows()" style="height: 70vh" />`,
 * })
 * export class AppComponent { ... }
 * ```
 *
 * The stylesheet is a separate import: `@ganttkit/angular/styles.css`.
 */
export { GanttChartComponent } from './gantt-chart.component.js'
export { createEngine } from './engine.js'
export type { GanttChartOptions } from './engine.js'
