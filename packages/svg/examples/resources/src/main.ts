import { createGantt } from '@ganttkit/svg'
import { createColumns } from '@ganttkit/plugin-columns'
import { createMarkers, todayMarker } from '@ganttkit/plugin-markers'
import { createScheduler, createSchedulerDnd, linkTimelines } from '@ganttkit/plugin-scheduler'
import '@ganttkit/svg/styles.css'
import './styles.css'
import {
  END_DATE,
  START_DATE,
  assignments,
  resources,
  taskClassName,
  taskRows,
  tasks,
} from './data'

const resourceEl = document.querySelector<HTMLElement>('#resources')!
const taskEl = document.querySelector<HTMLElement>('#tasks')!

// One source of truth for who is booked to what, when.
const scheduler = createScheduler({ resources, tasks, assignments, taskClassName })

// Shared engine options: identical date range → identical date→pixel mapping,
// and native bar-drag + click-pan OFF so the scheduler DnD coordinator owns the
// gesture (slot selection is a press-drag on empty lane space).
const shared = { startDate: START_DATE, endDate: END_DATE, viewMode: 'Week', draggable: false, enablePan: false } as const

// ── Top chart: resource lanes (rows come from the scheduler plugin) ──────────
const resourceEngine = createGantt({ target: resourceEl, rows: [], ...shared })
resourceEngine.use(createColumns({ sidebarWidth: 200, columns: [{ key: 'name', label: 'Resource' }] }).plugin)
resourceEngine.use(createMarkers([todayMarker()]).plugin)
resourceEngine.use(scheduler.resourcePlugin)

// ── Bottom chart: tasks (the drag source) ────────────────────────────────────
const taskEngine = createGantt({ target: taskEl, rows: taskRows, ...shared })
taskEngine.use(createColumns({
  sidebarWidth: 200,
  columns: [
    { key: 'name', label: 'Task' },
    {
      key: 'assigned',
      label: 'Assigned',
      width: 90,
      // Live roll-up: which resources are booked on this task.
      formatter: (row) => {
        const names = scheduler.assignmentsForTask(row.id)
          .map(a => scheduler.getResources().find(r => r.id === a.resourceId)?.name?.split(' ')[0])
          .filter(Boolean)
        return names.length ? [...new Set(names)].join(', ') : '—'
      },
    },
  ],
}).plugin)
taskEngine.use(createMarkers([todayMarker()]).plugin)

// Repaint the task chart's "Assigned" column whenever assignments change.
scheduler.subscribe(() => taskEngine.refresh())

// ── Sync + drag-to-assign ────────────────────────────────────────────────────
linkTimelines({ engines: [resourceEngine, taskEngine], roots: [resourceEl, taskEl] })

const log = document.querySelector<HTMLElement>('#log')
const print = (msg: string) => {
  if (log)
    log.textContent = `${msg}\n${log.textContent}`.split('\n').slice(0, 8).join('\n')
  else
    console.info('[scheduler]', msg)
}

createSchedulerDnd({
  scheduler,
  task: { engine: taskEngine, root: taskEl },
  resource: { engine: resourceEngine, root: resourceEl },
  onChange: (change) => {
    const task = scheduler.getTask(change.assignment.taskId)
    const res = scheduler.getResources().find(r => r.id === change.assignment.resourceId)
    print(`${change.type}: ${task?.name ?? change.assignment.taskId} → ${res?.name ?? change.assignment.resourceId}`)
  },
})

// Toolbar: view mode is kept in lockstep across both charts by linkTimelines,
// so changing either engine updates the other.
for (const mode of ['Day', 'Week', 'Month'] as const) {
  document.querySelector(`#vm-${mode}`)!.addEventListener('click', () => resourceEngine.setViewMode(mode))
}
document.querySelector('#theme')!.addEventListener('click', () => {
  for (const el of [resourceEl, taskEl]) {
    el.setAttribute('data-theme', el.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
  }
})
