import { useCallback, useState } from 'react'
import type { GanttRow, ViewMode } from '@ganttkit/core'
import { GanttChart } from '@ganttkit/react'
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

// Hierarchical data: phase rows (parents) with task rows (children).
const ROWS: GanttRow[] = [
  { id: 'design', name: 'Design', tasks: [] },
  { id: 'design-wf', name: 'Wireframes', parentId: 'design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08', progress: 1, className: 'task-completed' }] },
  { id: 'design-ui', name: 'UI mockups', parentId: 'design', tasks: [{ id: 't2', name: 'UI mockups', start: '2026-07-09', end: '2026-07-20', progress: 0.6, className: 'task-in-progress', dependencies: ['t1'] }] },
  { id: 'build', name: 'Build', tasks: [] },
  { id: 'build-api', name: 'API', parentId: 'build', tasks: [{ id: 't3', name: 'API', start: '2026-07-15', end: '2026-07-31', progress: 0.3, dependencies: ['t1'] }] },
  { id: 'build-fe', name: 'Frontend', parentId: 'build', tasks: [{ id: 't4', name: 'Frontend', start: '2026-07-21', end: '2026-08-12', progress: 0.1, className: 'task-high-priority', dependencies: ['t2'] }] },
  { id: 'release', name: 'Release', tasks: [] },
  { id: 'release-launch', name: 'Launch', parentId: 'release', tasks: [{ id: 'm1', name: 'Launch', start: '2026-08-15', end: '2026-08-15', kind: 'milestone', dependencies: ['t4'] }] },
]

export function App() {
  const [log, setLog] = useState<string[]>([])
  const print = useCallback((msg: string) => {
    setLog(previous => [msg, ...previous].slice(0, 8))
  }, [])

  // Plugin handles the toolbar buttons below drive. Built once per mount,
  // because <GanttChart> reads `plugins` when it builds its engine.
  const [chart] = useState(() => {
    const tree = createTree()
    const baseline = createBaseline()
    const filter = createFilter()
    const i18n = createI18n({
      locale: 'en',
      messages: {
        fr: { 'view.Day': 'Jour', 'view.Week': 'Semaine', 'view.Month': 'Mois', 'toolbar.today': "Aujourd'hui", 'toolbar.zoomIn': 'Zoom avant', 'toolbar.zoomOut': 'Zoom arriere', 'tooltip.complete': '{percent}% termine' },
        de: { 'view.Day': 'Tag', 'view.Week': 'Woche', 'view.Month': 'Monat', 'toolbar.today': 'Heute', 'tooltip.complete': '{percent}% erledigt' },
      },
    })

    const plugins = [
      // i18n FIRST, so the service is present when the toolbar/tooltip mount.
      i18n.plugin,
      toolbarPlugin(), // view mode / zoom / today, localized via the i18n service
      tooltipPlugin(), // hover card via the overlay slot
      createColumns({ sidebarWidth: 220, columns: [{ key: 'name', label: 'Task' }] }).plugin,
      progressPlugin(), // renders the `progress` fill inside bars
      createMarkers([
        todayMarker({ label: 'Today' }),
        { id: 'sprint1', date: '2026-07-10', end: '2026-07-17', label: 'Sprint 1' },
        { id: 'ga', date: '2026-08-20', label: 'GA', className: 'is-deadline' },
      ]).plugin,
      tree.plugin, // click the chevrons in the sidebar to collapse/expand
      // Auto-scheduling: drag a task and its dependents shift to keep finish-to-start.
      createDependencies({ autoSchedule: true }).plugin,
      // Baseline: capture the plan, then dragging a task shows the slip as a ghost bar.
      baseline.plugin,
      filter.plugin,
      // Selection: click / ctrl-click / shift-drag rubber-band, with a context menu.
      createSelection({
        menu: [{ label: 'Log selection', action: ids => print(`selected: ${ids.join(', ') || '(none)'}`) }],
      }).plugin,
    ]

    return { tree, baseline, filter, i18n, plugins }
  })

  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [query, setQuery] = useState('')

  return (
    <>
      <div className="toolbar">
        <strong>GanttKit (React)</strong>
        <button onClick={() => chart.tree.expandAll()}>Expand all</button>
        <button onClick={() => chart.tree.collapseAll()}>Collapse all</button>
        <button onClick={() => chart.baseline.capture()}>Set baseline</button>
        <button onClick={() => chart.baseline.clear()}>Clear baseline</button>
        <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>Toggle theme</button>
        <label>
          Lang
          <select defaultValue="en" onChange={e => chart.i18n.setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <input
          type="search"
          value={query}
          placeholder="Filter tasks..."
          onChange={(e) => {
            const q = e.target.value
            setQuery(q)
            chart.filter.setTaskFilter(q.trim() ? filters.taskNameIncludes(q.trim()) : null)
          }}
        />
        <span className="hint">| view: {viewMode} | drag bars | ctrl+wheel zoom</span>
      </div>

      <GanttChart
        className="chart"
        rows={ROWS}
        theme={theme}
        viewMode={viewMode}
        plugins={chart.plugins}
        onViewModeChange={({ viewMode: next }) => setViewMode(next)}
        onTaskClick={({ task }) => print(`click: ${task.name}`)}
        onTaskDragEnd={({ task, start, end, changed }) => {
          if (changed)
            print(`moved ${task.name} -> ${start.toDateString()} - ${end.toDateString()}`)
        }}
      />

      <pre className="log">{log.join('\n')}</pre>
    </>
  )
}
