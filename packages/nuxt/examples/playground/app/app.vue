<script setup lang="ts">
import type { GanttRow, ViewMode } from '@ganttkit/core'
import { createBaseline } from '@ganttkit/plugin-baseline'
import { createColumns } from '@ganttkit/plugin-columns'
import { createDependencies } from '@ganttkit/plugin-dependencies'
import { createFilter, filters } from '@ganttkit/plugin-filter'
import { createMarkers, todayMarker } from '@ganttkit/plugin-markers'
import { progressPlugin } from '@ganttkit/plugin-progress'
import { createSelection } from '@ganttkit/plugin-selection'
import { toolbarPlugin } from '@ganttkit/plugin-toolbar'
import { tooltipPlugin } from '@ganttkit/plugin-tooltip'
import { createTree } from '@ganttkit/plugin-tree'

// `<GanttChart>` is auto-imported by the module, no import above, and no
// `@ganttkit/vue` in this file's dependencies either.

/** Midnight today, so each offset below lands on a whole day. */
const today = new Date()
today.setHours(0, 0, 0, 0)

/**
 * `offset` days from today, as the `YYYY-MM-DD` the engine parses.
 *
 * Assembled from the local date parts rather than `toISOString()`, which
 * reports midnight local as the day before for anyone west of UTC.
 */
function day(offset: number): string {
  const date = new Date(today)
  date.setDate(date.getDate() + offset)
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Every date is an offset from today, so the playground always opens on a live
// timeline, the first task starts now and the rest keep their spacing. Fixed
// dates would drift into the past and leave the today marker off to one side.
const rows = ref<GanttRow[]>([
  { id: 'design', name: 'Design', tasks: [] },
  { id: 'design-wf', name: 'Wireframes', parentId: 'design', tasks: [{ id: 't1', name: 'Wireframes', start: day(0), end: day(23), progress: 1, className: 'task-completed' }] },
  { id: 'design-ui', name: 'UI mockups', parentId: 'design', tasks: [{ id: 't2', name: 'UI mockups', start: day(24), end: day(35), progress: 0.6, className: 'task-in-progress', dependencies: ['t1'] }] },
  { id: 'build', name: 'Build', tasks: [] },
  { id: 'build-api', name: 'API', parentId: 'build', tasks: [{ id: 't3', name: 'API', start: day(30), end: day(46), progress: 0.3, dependencies: ['t1'] }] },
  { id: 'build-fe', name: 'Frontend', parentId: 'build', tasks: [{ id: 't4', name: 'Frontend', start: day(36), end: day(58), progress: 0.1, className: 'task-high-priority', dependencies: ['t2'] }] },
  { id: 'release', name: 'Release', tasks: [] },
  { id: 'release-launch', name: 'Launch', parentId: 'release', tasks: [{ id: 'm1', name: 'Launch', start: day(61), end: day(61), kind: 'milestone', dependencies: ['t4'] }] },
])

const log = ref<string[]>([])
const print = (msg: string): void => { log.value = [msg, ...log.value].slice(0, 8) }

// Plugin handles the buttons below drive. Built once per component instance,
// because `plugins` is read when the engine is built.
const tree = createTree()
const baseline = createBaseline()
const filter = createFilter()

const plugins = [
  toolbarPlugin(),
  tooltipPlugin(),
  createColumns({ sidebarWidth: 220, columns: [{ key: 'name', label: 'Task' }] }).plugin,
  progressPlugin(),
  createMarkers([todayMarker({ label: 'Today' }), { id: 'ga', date: day(66), label: 'GA' }]).plugin,
  tree.plugin,
  createDependencies({ autoSchedule: true }).plugin,
  baseline.plugin,
  filter.plugin,
  createSelection({
    menu: [{ label: 'Log selection', action: (ids: string[]) => print(`selected: ${ids.join(', ') || '(none)'}`) }],
  }).plugin,
]

// `viewMode` starts from `ganttkit.defaults.viewMode` in nuxt.config; the
// toolbar plugin and ctrl+wheel write back through `v-model:view-mode`.
const viewMode = ref<ViewMode>('Week')
const theme = ref<'light' | 'dark'>('light')
const query = ref('')

function onSearch(): void {
  const q = query.value.trim()
  filter.setTaskFilter(q ? filters.taskNameIncludes(q) : null)
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <strong>GanttKit (Nuxt)</strong>
      <button @click="tree.expandAll()">Expand all</button>
      <button @click="tree.collapseAll()">Collapse all</button>
      <button @click="baseline.capture()">Set baseline</button>
      <button @click="theme = theme === 'dark' ? 'light' : 'dark'">Toggle theme</button>
      <input v-model="query" type="search" placeholder="Filter tasks..." @input="onSearch">
      <span class="hint">view: {{ viewMode }} | drag bars | ctrl+wheel zoom</span>
    </header>

    <GanttChart
      v-model:view-mode="viewMode"
      class="chart"
      :rows="rows"
      :theme="theme"
      :plugins="plugins"
      @task-click="({ task }) => print(`click: ${task.name}`)"
      @task-dragend="({ task, start, end, changed }) => changed && print(`moved ${task.name} -> ${start.toDateString()} - ${end.toDateString()}`)"
    />

    <pre class="log">{{ log.join('\n') }}</pre>
  </div>
</template>

<style>
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; }
.page { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hint { color: #6b7280; }
/* The chart needs a height: the server renders an empty box this tall, so the
   page does not jump when the engine paints into it after hydration. */
.chart { height: 70vh; }
.log { min-height: 4em; margin: 0; padding: 8px; background: #f3f4f6; border-radius: 6px; }
</style>
