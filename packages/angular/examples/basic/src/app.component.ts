import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import type { GanttRow, TaskDragEvent, ViewMode } from '@ganttkit/core'
import { GanttChartComponent } from '@ganttkit/angular'
import { createColumns } from '@ganttkit/plugin-columns'
import { createFilter, filters } from '@ganttkit/plugin-filter'
import { progressPlugin } from '@ganttkit/plugin-progress'
import { createMarkers, todayMarker } from '@ganttkit/plugin-markers'
import { createTree } from '@ganttkit/plugin-tree'
import { createBaseline } from '@ganttkit/plugin-baseline'
import { createDependencies } from '@ganttkit/plugin-dependencies'
import { toolbarPlugin } from '@ganttkit/plugin-toolbar'
import { tooltipPlugin } from '@ganttkit/plugin-tooltip'
import { createSelection } from '@ganttkit/plugin-selection'
import { createI18n } from '@ganttkit/plugin-i18n'

@Component({
  selector: 'app-root',
  imports: [GanttChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <strong>GanttKit (Angular)</strong>
      <button (click)="tree.expandAll()">Expand all</button>
      <button (click)="tree.collapseAll()">Collapse all</button>
      <button (click)="baseline.capture()">Set baseline</button>
      <button (click)="baseline.clear()">Clear baseline</button>
      <button (click)="toggleTheme()">Toggle theme</button>
      <label>Lang
        <select (change)="setLocale($event)">
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </label>
      <input type="search" placeholder="Filter tasks..." (input)="search($event)" />
      <span class="hint">| view: {{ viewMode() }} | drag bars | ctrl+wheel zoom</span>
    </div>

    <gantt-chart
      class="chart"
      [rows]="rows"
      [theme]="theme()"
      [viewMode]="viewMode()"
      [plugins]="plugins"
      (viewModeChange)="viewMode.set($event.viewMode)"
      (taskClick)="print('click: ' + $event.task.name)"
      (taskDragEnd)="onDragEnd($event)"
    />

    <pre class="log">{{ logText() }}</pre>
  `,
})
export class AppComponent {
  // Hierarchical data: phase rows (parents) with task rows (children).
  readonly rows: GanttRow[] = [
    { id: 'design', name: 'Design', tasks: [] },
    { id: 'design-wf', name: 'Wireframes', parentId: 'design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08', progress: 1, className: 'task-completed' }] },
    { id: 'design-ui', name: 'UI mockups', parentId: 'design', tasks: [{ id: 't2', name: 'UI mockups', start: '2026-07-09', end: '2026-07-20', progress: 0.6, className: 'task-in-progress', dependencies: ['t1'] }] },
    { id: 'build', name: 'Build', tasks: [] },
    { id: 'build-api', name: 'API', parentId: 'build', tasks: [{ id: 't3', name: 'API', start: '2026-07-15', end: '2026-07-31', progress: 0.3, dependencies: ['t1'] }] },
    { id: 'build-fe', name: 'Frontend', parentId: 'build', tasks: [{ id: 't4', name: 'Frontend', start: '2026-07-21', end: '2026-08-12', progress: 0.1, className: 'task-high-priority', dependencies: ['t2'] }] },
    { id: 'release', name: 'Release', tasks: [] },
    { id: 'release-launch', name: 'Launch', parentId: 'release', tasks: [{ id: 'm1', name: 'Launch', start: '2026-08-15', end: '2026-08-15', kind: 'milestone', dependencies: ['t4'] }] },
  ]

  private readonly log = signal<string[]>([])
  readonly logText = computed(() => this.log().join('\n'))

  // Plugin handles the toolbar buttons drive. Built once, because <gantt-chart>
  // reads `plugins` when it builds its engine.
  readonly tree = createTree()
  readonly baseline = createBaseline()
  readonly filter = createFilter()
  readonly i18n = createI18n({
    locale: 'en',
    messages: {
      fr: { 'view.Day': 'Jour', 'view.Week': 'Semaine', 'view.Month': 'Mois', 'toolbar.today': "Aujourd'hui", 'toolbar.zoomIn': 'Zoom avant', 'toolbar.zoomOut': 'Zoom arriere', 'tooltip.complete': '{percent}% termine' },
      de: { 'view.Day': 'Tag', 'view.Week': 'Woche', 'view.Month': 'Monat', 'toolbar.today': 'Heute', 'tooltip.complete': '{percent}% erledigt' },
    },
  })

  readonly plugins = [
    // i18n FIRST, so the service is present when the toolbar/tooltip mount.
    this.i18n.plugin,
    toolbarPlugin(), // view mode / zoom / today, localized via the i18n service
    tooltipPlugin(), // hover card via the overlay slot
    createColumns({ sidebarWidth: 220, columns: [{ key: 'name', label: 'Task' }] }).plugin,
    progressPlugin(), // renders the `progress` fill inside bars
    createMarkers([
      todayMarker({ label: 'Today' }),
      { id: 'sprint1', date: '2026-07-10', end: '2026-07-17', label: 'Sprint 1' },
      { id: 'ga', date: '2026-08-20', label: 'GA', className: 'is-deadline' },
    ]).plugin,
    this.tree.plugin, // click the chevrons in the sidebar to collapse/expand
    // Auto-scheduling: drag a task and its dependents shift to keep finish-to-start.
    createDependencies({ autoSchedule: true }).plugin,
    // Baseline: capture the plan, then dragging a task shows the slip as a ghost bar.
    this.baseline.plugin,
    this.filter.plugin,
    // Selection: click / ctrl-click / shift-drag rubber-band, with a context menu.
    createSelection({
      menu: [{ label: 'Log selection', action: ids => this.print(`selected: ${ids.join(', ') || '(none)'}`) }],
    }).plugin,
  ]

  readonly viewMode = signal<ViewMode>('Week')
  readonly theme = signal<'light' | 'dark'>('light')

  print(message: string): void {
    this.log.update(previous => [message, ...previous].slice(0, 8))
  }

  toggleTheme(): void {
    this.theme.update(current => (current === 'dark' ? 'light' : 'dark'))
  }

  setLocale(event: Event): void {
    this.i18n.setLocale((event.target as HTMLSelectElement).value)
  }

  search(event: Event): void {
    const query = (event.target as HTMLInputElement).value.trim()
    this.filter.setTaskFilter(query ? filters.taskNameIncludes(query) : null)
  }

  onDragEnd({ task, start, end, changed }: TaskDragEvent): void {
    if (changed)
      this.print(`moved ${task.name} -> ${start.toDateString()} - ${end.toDateString()}`)
  }
}
