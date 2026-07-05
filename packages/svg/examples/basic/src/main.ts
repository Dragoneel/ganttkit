import type { GanttRow } from '@ganttkit/core'
import { createGantt } from '@ganttkit/svg'
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
import '@ganttkit/svg/styles.css'

// Hierarchical data: phase rows (parents) with task rows (children).
const rows: GanttRow[] = [
  { id: 'design', name: 'Design', tasks: [] },
  { id: 'design-wf', name: 'Wireframes', parentId: 'design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08', progress: 1, className: 'task-completed' }] },
  { id: 'design-ui', name: 'UI mockups', parentId: 'design', tasks: [{ id: 't2', name: 'UI mockups', start: '2026-07-09', end: '2026-07-20', progress: 0.6, className: 'task-in-progress', dependencies: ['t1'] }] },
  { id: 'build', name: 'Build', tasks: [] },
  { id: 'build-api', name: 'API', parentId: 'build', tasks: [{ id: 't3', name: 'API', start: '2026-07-15', end: '2026-07-31', progress: 0.3, dependencies: ['t1'] }] },
  { id: 'build-fe', name: 'Frontend', parentId: 'build', tasks: [{ id: 't4', name: 'Frontend', start: '2026-07-21', end: '2026-08-12', progress: 0.1, className: 'task-high-priority', dependencies: ['t2'] }] },
  { id: 'release', name: 'Release', tasks: [] },
  { id: 'release-launch', name: 'Launch', parentId: 'release', tasks: [{ id: 'm1', name: 'Launch', start: '2026-08-15', end: '2026-08-15', kind: 'milestone', dependencies: ['t4'] }] },
]

const gantt = createGantt({ target: '#app', rows, viewMode: 'Week', highlightToday: true })

// i18n FIRST, so the service is present when the toolbar/tooltip mount.
const i18n = createI18n({
  locale: 'en',
  messages: {
    fr: { 'view.Day': 'Jour', 'view.Week': 'Semaine', 'view.Month': 'Mois', 'toolbar.today': "Aujourd'hui", 'toolbar.zoomIn': 'Zoom avant', 'toolbar.zoomOut': 'Zoom arriere', 'tooltip.complete': '{percent}% termine' },
    de: { 'view.Day': 'Tag', 'view.Week': 'Woche', 'view.Month': 'Monat', 'toolbar.today': 'Heute', 'tooltip.complete': '{percent}% erledigt' },
  },
})
gantt.use(i18n.plugin)

// Feature plugins (none of these live in the core engine):
gantt.use(toolbarPlugin()) // view mode / zoom / today, localized via the i18n service
gantt.use(tooltipPlugin()) // hover card via the overlay slot
gantt.use(createColumns({ sidebarWidth: 220, columns: [{ key: 'name', label: 'Task' }] }).plugin)
gantt.use(progressPlugin()) // renders the `progress` fill inside bars
gantt.use(createMarkers([
  todayMarker({ label: 'Today' }),
  { id: 'sprint1', date: '2026-07-10', end: '2026-07-17', label: 'Sprint 1' },
  { id: 'ga', date: '2026-08-20', label: 'GA', className: 'is-deadline' },
]).plugin)

const tree = createTree()
gantt.use(tree.plugin) // click the chevrons in the sidebar to collapse/expand

// Auto-scheduling: drag a task and its dependents shift to keep finish-to-start.
gantt.use(createDependencies({ autoSchedule: true }).plugin)

// Baseline: capture the plan, then dragging a task shows the slip as a ghost bar.
const baseline = createBaseline()
gantt.use(baseline.plugin)

const filter = createFilter()
gantt.use(filter.plugin)

// Selection: click / ctrl-click / shift-drag rubber-band, with a context menu.
const log = document.getElementById('log')!
const print = (msg: string) => { log.textContent = `${msg}\n${log.textContent}`.split('\n').slice(0, 8).join('\n') }
gantt.use(createSelection({
  menu: [{ label: 'Log selection', action: ids => print(`selected: ${ids.join(', ') || '(none)'}`) }],
}).plugin)

// Toolbar wiring (custom buttons outside the chart; view mode is in the plugin toolbar).
document.getElementById('expand')!.addEventListener('click', () => tree.expandAll())
document.getElementById('collapse')!.addEventListener('click', () => tree.collapseAll())
document.getElementById('baseline')!.addEventListener('click', () => baseline.capture())
document.getElementById('clear-baseline')!.addEventListener('click', () => baseline.clear())
document.getElementById('theme')!.addEventListener('click', () => {
  const root = document.querySelector<HTMLElement>('.gantt')!
  root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
})
document.getElementById('search')!.addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value.trim()
  filter.setTaskFilter(q ? filters.taskNameIncludes(q) : null)
})
document.getElementById('locale')!.addEventListener('change', (e) => {
  i18n.setLocale((e.target as HTMLSelectElement).value)
})

// Observe engine events.
gantt.events.on('task:click', ({ task }) => print(`click: ${task.name}`))
gantt.events.on('task:dragend', ({ task, start, end, changed }) => {
  if (changed)
    print(`moved ${task.name} → ${start.toDateString()} – ${end.toDateString()}`)
})
