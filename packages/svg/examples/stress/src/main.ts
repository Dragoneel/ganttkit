import { GanttEngine, buildScene, computeDependencyLinks, computeTaskLayouts } from '@ganttkit/core'
import { svgRenderer } from '@ganttkit/svg'
import { createColumns } from '@ganttkit/plugin-columns'
import { createFilter, filters } from '@ganttkit/plugin-filter'
import { createTree } from '@ganttkit/plugin-tree'
import '@ganttkit/svg/styles.css'
import { generateDataset } from './dataset'

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

let engine: GanttEngine | null = null
let activeFilter: ReturnType<typeof createFilter> | null = null

interface Metrics {
  rows: number
  tasks: number
  dependencies: number
  milestones: number
  genTime: number
  initEngine: number
  initPaint: number
  primitives: number
  domNodes: number
  cpuBuild: number
  vMonth: number
  vDay: number
  vWeek: number
  filterOn: number
  filterOff: number
  heapMb: number | null
}

function run(rowCount: number, tasksPerRow: number): void {
  engine?.destroy()
  const app = document.getElementById('app')!
  app.replaceChildren()

  // 1. Dataset generation (pure JS).
  const genStart = performance.now()
  const { rows, stats } = generateDataset(rowCount, tasksPerRow)
  const genTime = performance.now() - genStart

  // 2. Engine construction = full compute pipeline (timescale → layout → scene).
  let e!: GanttEngine
  const initEngine = time(() => { e = new GanttEngine({ rows, viewMode: 'Week', highlightToday: true }) })

  // 3. Initial paint = renderer attaches and renders the SVG + sidebar.
  const initPaint = time(() => {
    // Custom chevron: inline SVG icons (currentColor inherits the toggle color).
    const chevron = (d: string) =>
      `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
    e.use(svgRenderer({
      target: app,
      chevron: { collapsed: chevron('M3 1 L7 5 L3 9'), expanded: chevron('M1 3 L5 7 L9 3') },
    }))
    // Hierarchical rows (parent "code" groups → resource children).
    e.use(createTree().plugin)
    // Code is the second column, and hosts the tree chevron via `treeColumn`.
    // Columns are resizable (drag a header edge) and widths persist in localStorage.
    e.use(createColumns({
      sidebarWidth: 260,
      treeColumn: 'id',
      persistWidths: 'ganttkit-stress-columns',
      columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'Code' }],
    }).plugin)
  })
  engine = e

  // 4. Scene + DOM size.
  const scene = e.getScene()
  const primitives = scene.layers.reduce((sum, l) => sum + l.primitives.length, 0)
  const domNodes = app.querySelector('.gantt__svg')!.querySelectorAll('*').length

  // 5. Core-only scene build (CPU, no DOM)  the cost of one drag-preview frame.
  const scale = e.getTimeScale()
  const opts = e.getOptions()
  const cpuBuild = average(() => {
    const layouts = computeTaskLayouts(rows, scale, opts.rowHeight, opts.barPadding, opts.dateAdapter)
    const links = computeDependencyLinks(layouts)
    buildScene({ rowCount: rows.length, scale, layouts, links, options: opts })
  }, 5)

  // 6. View-mode switches = recompute + full repaint.
  const vMonth = time(() => e.setViewMode('Month'))
  const vDay = time(() => e.setViewMode('Day'))
  const vWeek = time(() => e.setViewMode('Week'))

  // 7. Filtering = data-hook recompute + repaint.
  const filter = createFilter()
  e.use(filter.plugin)
  activeFilter = filter
  const filterOn = time(() => filter.setTaskFilter(filters.taskNameIncludes('task 1')))
  const filterOff = time(() => filter.clear())

  const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  renderMetrics({
    ...stats,
    genTime,
    initEngine,
    initPaint,
    primitives,
    domNodes,
    cpuBuild,
    vMonth,
    vDay,
    vWeek,
    filterOn,
    filterOff,
    heapMb: heap ? heap.usedJSHeapSize / 1048576 : null,
  })
}

function renderMetrics(m: Metrics): void {
  const num = (n: number) => n.toLocaleString('en-US')
  const row = (label: string, value: string, klass = '') => `<tr><td>${label}</td><td class="${klass}">${value}</td></tr>`

  document.getElementById('metrics')!.innerHTML = `
    <table>
      <caption>Dataset</caption>
      ${row('Rows', num(m.rows))}
      ${row('Tasks', num(m.tasks))}
      ${row('Dependencies', num(m.dependencies))}
      ${row('Milestones', num(m.milestones))}
      ${row('Scene primitives (visible)', num(m.primitives))}
      ${row('SVG DOM nodes (visible)', num(m.domNodes))}
    </table>
    <table style="margin-top:12px">
      <caption>Timings</caption>
      ${row('Generate data', ms(m.genTime))}
      ${row('Engine compute (init)', ms(m.initEngine), cls(m.initEngine))}
      ${row('Initial paint', ms(m.initPaint), cls(m.initPaint))}
      ${row('Full scene build (CPU)', `${ms(m.cpuBuild)} · ${rate(m.cpuBuild)}`, cls(m.cpuBuild))}
      ${row('→ Month (recompute+paint)', ms(m.vMonth), cls(m.vMonth))}
      ${row('→ Day (recompute+paint)', ms(m.vDay), cls(m.vDay))}
      ${row('→ Week (recompute+paint)', ms(m.vWeek), cls(m.vWeek))}
      ${row('Apply filter', ms(m.filterOn), cls(m.filterOn))}
      ${row('Clear filter', ms(m.filterOff), cls(m.filterOff))}
      ${m.heapMb != null ? row('JS heap used', `${m.heapMb.toFixed(0)} MB`) : ''}
    </table>
    <p style="font-size:12px;color:#6b7280;margin:8px 2px">
      green &lt; 16 ms (60 fps) · amber &lt; 50 ms · red ≥ 50 ms.
      ${m.heapMb == null ? 'Run Chromium with <code>--enable-precise-memory-info</code> for heap stats.' : ''}
    </p>`
}

// Wire controls.
document.getElementById('run')!.addEventListener('click', () => {
  const [rows, per] = (document.getElementById('size') as HTMLSelectElement).value.split(',').map(Number)
  run(rows!, per!)
})
document.getElementById('search')!.addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value.trim()
  activeFilter?.setTaskFilter(q ? filters.taskNameIncludes(q) : null)
})

// Initial run.
run(1000, 5)
