import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { GanttEngine, GanttPlugin, GanttRow } from '@ganttkit/core'
import { buildScene, computeDependencyLinks, computeTaskLayouts } from '@ganttkit/core'
import { GanttChartComponent } from '@ganttkit/angular'
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

interface Pending {
  t0: number
  genTime: number
  rows: GanttRow[]
  stats: { rows: number, tasks: number, dependencies: number, milestones: number }
}

/** Custom chevron: inline SVG icons (currentColor inherits the toggle color). */
const chevronIcon = (d: string) =>
  `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`

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

@Component({
  selector: 'app-root',
  imports: [GanttChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <strong>GanttKit | Angular stress test</strong>
      <label>Dataset
        <select (change)="setSize($event)">
          @for (option of sizes; track option.value) {
            <option [value]="option.value" [selected]="option.value === size()">{{ option.label }}</option>
          }
        </select>
      </label>
      <button (click)="run()">Run benchmark</button>
      <input type="search" placeholder="Filter tasks..." (input)="search($event)" />
      <span style="color:#6b7280">drag | ctrl+wheel zoom | drag empty space to pan</span>
    </header>

    <div class="wrap">
      <div class="metrics">
        @if (metrics(); as m) {
          <table>
            <caption>Dataset</caption>
            <tbody>
              <tr><td>Rows</td><td>{{ num(m.rows) }}</td></tr>
              <tr><td>Tasks</td><td>{{ num(m.tasks) }}</td></tr>
              <tr><td>Dependencies</td><td>{{ num(m.dependencies) }}</td></tr>
              <tr><td>Milestones</td><td>{{ num(m.milestones) }}</td></tr>
              <tr><td>Scene primitives (visible)</td><td>{{ num(m.primitives) }}</td></tr>
              <tr><td>HTML DOM nodes (visible)</td><td>{{ num(m.domNodes) }}</td></tr>
            </tbody>
          </table>
          <table style="margin-top:12px">
            <caption>Timings</caption>
            <tbody>
              <tr><td>Generate data</td><td>{{ ms(m.genTime) }}</td></tr>
              <tr><td>Mount (render + compute + paint)</td><td [class]="cls(m.mount)">{{ ms(m.mount) }}</td></tr>
              <tr><td>Full scene build (CPU)</td><td [class]="cls(m.cpuBuild)">{{ ms(m.cpuBuild) }} | {{ rate(m.cpuBuild) }}</td></tr>
              <tr><td>-> Month (recompute+paint)</td><td [class]="cls(m.vMonth)">{{ ms(m.vMonth) }}</td></tr>
              <tr><td>-> Day (recompute+paint)</td><td [class]="cls(m.vDay)">{{ ms(m.vDay) }}</td></tr>
              <tr><td>-> Week (recompute+paint)</td><td [class]="cls(m.vWeek)">{{ ms(m.vWeek) }}</td></tr>
              <tr><td>Apply filter</td><td [class]="cls(m.filterOn)">{{ ms(m.filterOn) }}</td></tr>
              <tr><td>Clear filter</td><td [class]="cls(m.filterOff)">{{ ms(m.filterOff) }}</td></tr>
              @if (m.heapMb !== null) {
                <tr><td>JS heap used</td><td>{{ m.heapMb.toFixed(0) }} MB</td></tr>
              }
            </tbody>
          </table>
          <p class="note">
            green &lt; 16 ms (60 fps) | amber &lt; 50 ms | red >= 50 ms.
            @if (m.heapMb === null) {
              Run Chromium with <code>--enable-precise-memory-info</code> for heap stats.
            }
          </p>
        }
      </div>

      <!-- One-element keyed loop: bumping the id destroys the chart and builds
           a fresh engine, which is what the mount timing below measures. -->
      @for (id of runIds(); track id) {
        <gantt-chart
          class="chart"
          [rows]="rows()"
          [plugins]="plugins()"
          [chevron]="chevron"
          (ready)="onReady($event)"
        />
      }
    </div>
  `,
})
export class AppComponent {
  readonly sizes = [
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

  readonly chevron = {
    collapsed: chevronIcon('M3 1 L7 5 L3 9'),
    expanded: chevronIcon('M1 3 L5 7 L9 3'),
  }

  readonly size = signal('1000,5')
  readonly rows = signal<GanttRow[]>([])
  readonly plugins = signal<GanttPlugin[]>([])
  readonly runIds = signal<number[]>([])
  readonly metrics = signal<Metrics | null>(null)

  private filter: ReturnType<typeof createFilter> | null = null
  private pending: Pending | null = null
  private nextRunId = 0

  readonly ms = (n: number) => `${n.toFixed(1)} ms`
  readonly rate = (n: number) => (n > 0 ? `${(1000 / n).toFixed(0)} fps` : '')
  readonly cls = (n: number) => (n < 16 ? 'good' : n < 50 ? 'warn' : 'bad')
  readonly num = (n: number) => n.toLocaleString('en-US')

  constructor() {
    this.run()
  }

  run(): void {
    const [rowCount, tasksPerRow] = this.size().split(',').map(Number)

    // 1. Dataset generation (pure JS).
    const genStart = performance.now()
    const { rows, stats } = generateDataset(rowCount!, tasksPerRow!)
    const genTime = performance.now() - genStart

    // Fresh plugin instances per run - each remount installs into a new engine.
    const filter = createFilter()
    this.filter = filter

    // 2. Mount = the whole framework path: change detection, engine compute
    //    (timescale -> layout -> scene) and the renderer's first paint. The clock
    //    stops in `onReady`, which fires once the engine has painted.
    this.pending = { t0: performance.now(), genTime, rows, stats }
    this.rows.set(rows)
    this.plugins.set([
      // Hierarchical rows (parent "code" groups -> resource children).
      createTree().plugin,
      // Code is the second column, and hosts the tree chevron via `treeColumn`.
      // Columns are resizable (drag a header edge) and widths persist in localStorage.
      createColumns({
        sidebarWidth: 260,
        treeColumn: 'id',
        persistWidths: 'ganttkit-stress-columns-angular',
        columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'Code' }],
      }).plugin,
      filter.plugin,
    ])
    this.runIds.set([this.nextRunId++])
  }

  onReady(engine: GanttEngine): void {
    const started = this.pending
    if (!started)
      return
    this.pending = null
    const mount = performance.now() - started.t0

    // 3. Scene + DOM size.
    const scene = engine.getScene()
    const primitives = scene.layers.reduce((sum, layer) => sum + layer.primitives.length, 0)
    const domNodes = document.querySelector('.chart .gantt__html')?.querySelectorAll('*').length ?? 0

    // 4. Core-only scene build (CPU, no DOM) - the cost of one drag-preview frame.
    const scale = engine.getTimeScale()
    const opts = engine.getOptions()
    const cpuBuild = average(() => {
      const layouts = computeTaskLayouts(started.rows, scale, opts.rowHeight, opts.barPadding, opts.dateAdapter)
      const links = computeDependencyLinks(layouts)
      buildScene({ rowCount: started.rows.length, scale, layouts, links, options: opts })
    }, 5)

    // 5. View-mode switches = recompute + full repaint.
    const vMonth = time(() => engine.setViewMode('Month'))
    const vDay = time(() => engine.setViewMode('Day'))
    const vWeek = time(() => engine.setViewMode('Week'))

    // 6. Filtering = data-hook recompute + repaint.
    const filter = this.filter!
    const filterOn = time(() => filter.setTaskFilter(filters.taskNameIncludes('task 1')))
    const filterOff = time(() => filter.clear())

    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    this.metrics.set({
      ...started.stats,
      primitives,
      domNodes,
      genTime: started.genTime,
      mount,
      cpuBuild,
      vMonth,
      vDay,
      vWeek,
      filterOn,
      filterOff,
      heapMb: heap ? heap.usedJSHeapSize / 1048576 : null,
    })
  }

  setSize(event: Event): void {
    this.size.set((event.target as HTMLSelectElement).value)
  }

  search(event: Event): void {
    const query = (event.target as HTMLInputElement).value.trim()
    this.filter?.setTaskFilter(query ? filters.taskNameIncludes(query) : null)
  }
}
