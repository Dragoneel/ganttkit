<script setup lang="ts">
import { nextTick, onMounted, ref, shallowRef } from 'vue'
import type { GanttEngine, GanttPlugin, GanttRow } from '@ganttkit/core'
import { buildScene, computeDependencyLinks, computeTaskLayouts } from '@ganttkit/core'
import { GanttChart } from '@ganttkit/vue'
import { createColumns } from '@ganttkit/plugin-columns'
import { createFilter, filters } from '@ganttkit/plugin-filter'
import { createTree } from '@ganttkit/plugin-tree'
import { generateDataset } from './dataset'

interface Metrics {
  rows: number
  tasks: number
  dependencies: number
  milestones: number
  primitives: number
  domNodes: number
  genTime: number
  mount: number
  cpuBuild: number
  vMonth: number
  vDay: number
  vWeek: number
  filterOn: number
  filterOff: number
  heapMb: number | null
}

const SIZES = [
  { value: '100,4', label: '100 rows x 4 (400 tasks)' },
  { value: '500,4', label: '500 rows x 4 (2k tasks)' },
  { value: '1000,5', label: '1 000 rows x 5 (5k tasks)' },
  { value: '2000,5', label: '2 000 rows x 5 (10k tasks)' },
  { value: '5000,4', label: '5 000 rows x 4 (20k tasks)' },
  { value: '10000,4', label: '10 000 rows x 4 (40k tasks)' },
  { value: '20000,4', label: '20 000 rows x 4 (80k tasks)' },
  { value: '50000,4', label: '50 000 rows x 4 (200k tasks)' },
  { value: '100000,4', label: '100 000 rows x 4 (400k tasks)' },
  { value: '200000,4', label: '200 000 rows x 4 (800k tasks)' },
]

/** Custom chevron: inline SVG icons (currentColor inherits the toggle color). */
const chevronIcon = (d: string) =>
  `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
const chevron = { collapsed: chevronIcon('M3 1 L7 5 L3 9'), expanded: chevronIcon('M1 3 L5 7 L9 3') }

/** Run `fn` once and return elapsed ms. */
function time(fn: () => void): number {
  const t = performance.now()
  fn()
  return performance.now() - t
}

/** Average elapsed ms of `fn` over `n` runs. */
function average(fn: () => void, n: number): number {
  let total = 0
  for (let i = 0; i < n; i++)
    total += time(fn)
  return total / n
}

const ms = (n: number) => `${n.toFixed(1)} ms`
const rate = (n: number) => (n > 0 ? `${(1000 / n).toFixed(0)} fps` : '')
const cls = (n: number) => (n < 16 ? 'good' : n < 50 ? 'warn' : 'bad')
const num = (n: number) => n.toLocaleString('en-US')

const size = ref('1000,5')
const query = ref('')
const runId = ref(0)
const rows = shallowRef<GanttRow[]>([])
const plugins = shallowRef<GanttPlugin[]>([])
const metrics = ref<Metrics | null>(null)

let filter: ReturnType<typeof createFilter> | null = null
let engine: GanttEngine | null = null

/** Fresh plugin instances per run - each remount installs into a new engine. */
function makePlugins(): GanttPlugin[] {
  filter = createFilter()
  return [
    // Hierarchical rows (parent "code" groups -> resource children).
    createTree().plugin,
    // Code is the second column, and hosts the tree chevron via `treeColumn`.
    // Columns are resizable (drag a header edge) and widths persist in localStorage.
    createColumns({
      sidebarWidth: 260,
      treeColumn: 'id',
      persistWidths: 'ganttkit-stress-columns-vue',
      columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'Code' }],
    }).plugin,
    filter.plugin,
  ]
}

async function run(): Promise<void> {
  const [rowCount, tasksPerRow] = size.value.split(',').map(Number)

  // 1. Dataset generation (pure JS).
  const genStart = performance.now()
  const { rows: generated, stats } = generateDataset(rowCount!, tasksPerRow!)
  const genTime = performance.now() - genStart

  // 2. Mount = the whole framework path: Vue re-render, engine compute
  //    (timescale -> layout -> scene) and the renderer's first paint. Bumping the
  //    key tears the old chart down and builds a fresh one.
  const mountStart = performance.now()
  rows.value = generated
  plugins.value = makePlugins()
  runId.value++
  await nextTick()
  const mount = performance.now() - mountStart

  const e = engine!

  // 3. Scene + DOM size.
  const scene = e.getScene()
  const primitives = scene.layers.reduce((sum, l) => sum + l.primitives.length, 0)
  const domNodes = document.querySelector('.chart .gantt__html')?.querySelectorAll('*').length ?? 0

  // 4. Core-only scene build (CPU, no DOM) - the cost of one drag-preview frame.
  const scale = e.getTimeScale()
  const opts = e.getOptions()
  const cpuBuild = average(() => {
    const layouts = computeTaskLayouts(generated, scale, opts.rowHeight, opts.barPadding, opts.dateAdapter)
    const links = computeDependencyLinks(layouts)
    buildScene({ rowCount: generated.length, scale, layouts, links, options: opts })
  }, 5)

  // 5. View-mode switches = recompute + full repaint.
  const vMonth = time(() => e.setViewMode('Month'))
  const vDay = time(() => e.setViewMode('Day'))
  const vWeek = time(() => e.setViewMode('Week'))

  // 6. Filtering = data-hook recompute + repaint.
  const filterOn = time(() => filter!.setTaskFilter(filters.taskNameIncludes('task 1')))
  const filterOff = time(() => filter!.clear())

  const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  metrics.value = {
    ...stats,
    primitives,
    domNodes,
    genTime,
    mount,
    cpuBuild,
    vMonth,
    vDay,
    vWeek,
    filterOn,
    filterOff,
    heapMb: heap ? heap.usedJSHeapSize / 1048576 : null,
  }
}

function onSearch(): void {
  const q = query.value.trim()
  filter?.setTaskFilter(q ? filters.taskNameIncludes(q) : null)
}

onMounted(run)
</script>

<template>
  <header>
    <strong>GanttKit | Vue stress test</strong>
    <label>Dataset
      <select v-model="size">
        <option v-for="option in SIZES" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>
    <button @click="run">Run benchmark</button>
    <input v-model="query" type="search" placeholder="Filter tasks..." @input="onSearch" />
    <span style="color:#6b7280">drag | ctrl+wheel zoom | drag empty space to pan</span>
  </header>

  <div class="wrap">
    <div class="metrics">
      <template v-if="metrics">
        <table>
          <caption>Dataset</caption>
          <tbody>
            <tr><td>Rows</td><td>{{ num(metrics.rows) }}</td></tr>
            <tr><td>Tasks</td><td>{{ num(metrics.tasks) }}</td></tr>
            <tr><td>Dependencies</td><td>{{ num(metrics.dependencies) }}</td></tr>
            <tr><td>Milestones</td><td>{{ num(metrics.milestones) }}</td></tr>
            <tr><td>Scene primitives (visible)</td><td>{{ num(metrics.primitives) }}</td></tr>
            <tr><td>HTML DOM nodes (visible)</td><td>{{ num(metrics.domNodes) }}</td></tr>
          </tbody>
        </table>
        <table style="margin-top:12px">
          <caption>Timings</caption>
          <tbody>
            <tr><td>Generate data</td><td>{{ ms(metrics.genTime) }}</td></tr>
            <tr><td>Mount (render + compute + paint)</td><td :class="cls(metrics.mount)">{{ ms(metrics.mount) }}</td></tr>
            <tr><td>Full scene build (CPU)</td><td :class="cls(metrics.cpuBuild)">{{ ms(metrics.cpuBuild) }} | {{ rate(metrics.cpuBuild) }}</td></tr>
            <tr><td>-> Month (recompute+paint)</td><td :class="cls(metrics.vMonth)">{{ ms(metrics.vMonth) }}</td></tr>
            <tr><td>-> Day (recompute+paint)</td><td :class="cls(metrics.vDay)">{{ ms(metrics.vDay) }}</td></tr>
            <tr><td>-> Week (recompute+paint)</td><td :class="cls(metrics.vWeek)">{{ ms(metrics.vWeek) }}</td></tr>
            <tr><td>Apply filter</td><td :class="cls(metrics.filterOn)">{{ ms(metrics.filterOn) }}</td></tr>
            <tr><td>Clear filter</td><td :class="cls(metrics.filterOff)">{{ ms(metrics.filterOff) }}</td></tr>
            <tr v-if="metrics.heapMb != null"><td>JS heap used</td><td>{{ metrics.heapMb.toFixed(0) }} MB</td></tr>
          </tbody>
        </table>
        <p class="note">
          green &lt; 16 ms (60 fps) | amber &lt; 50 ms | red >= 50 ms.
          <template v-if="metrics.heapMb == null">Run Chromium with <code>--enable-precise-memory-info</code> for heap stats.</template>
        </p>
      </template>
    </div>

    <GanttChart
      :key="runId"
      class="chart"
      :rows="rows"
      :plugins="plugins"
      :chevron="chevron"
      @ready="engine = $event"
    />
  </div>
</template>
