import { useCallback, useEffect, useRef, useState } from 'react'
import type { GanttEngine, GanttPlugin, GanttRow } from '@ganttkit/core'
import { buildScene, computeDependencyLinks, computeTaskLayouts } from '@ganttkit/core'
import { GanttChart } from '@ganttkit/react'
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
  ['100,4', '100 rows x 4 (400 tasks)'],
  ['500,4', '500 rows x 4 (2k tasks)'],
  ['1000,5', '1 000 rows x 5 (5k tasks)'],
  ['2000,5', '2 000 rows x 5 (10k tasks)'],
  ['5000,4', '5 000 rows x 4 (20k tasks)'],
  ['10000,4', '10 000 rows x 4 (40k tasks)'],
  ['20000,4', '20 000 rows x 4 (80k tasks)'],
  ['50000,4', '50 000 rows x 4 (200k tasks)'],
  ['100000,4', '100 000 rows x 4 (400k tasks)'],
  ['200000,4', '200 000 rows x 4 (800k tasks)'],
] as const

const INITIAL_SIZE = '1000,5'

/** Custom chevron: inline SVG icons (currentColor inherits the toggle color). */
const chevronIcon = (d: string) =>
  `<svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
const CHEVRON = { collapsed: chevronIcon('M3 1 L7 5 L3 9'), expanded: chevronIcon('M1 3 L5 7 L9 3') }

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

interface Pending {
  t0: number
  genTime: number
  rows: GanttRow[]
  stats: { rows: number, tasks: number, dependencies: number, milestones: number }
}

export function App() {
  const [size, setSize] = useState(INITIAL_SIZE)
  const [query, setQuery] = useState('')
  const [runId, setRunId] = useState(0)
  const [rows, setRows] = useState<GanttRow[]>([])
  const [plugins, setPlugins] = useState<GanttPlugin[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const filterRef = useRef<ReturnType<typeof createFilter> | null>(null)
  const pending = useRef<Pending | null>(null)

  const run = useCallback((value: string) => {
    const [rowCount, tasksPerRow] = value.split(',').map(Number)

    // 1. Dataset generation (pure JS).
    const genStart = performance.now()
    const { rows: generated, stats } = generateDataset(rowCount!, tasksPerRow!)
    const genTime = performance.now() - genStart

    // Fresh plugin instances per run - each remount installs into a new engine.
    const filter = createFilter()
    filterRef.current = filter

    // 2. Mount = the whole framework path: React render, engine compute
    //    (timescale -> layout -> scene) and the renderer's first paint. Bumping
    //    the key tears the old chart down and builds a fresh one; the clock
    //    stops in `onReady`, which fires once the engine has painted.
    pending.current = { t0: performance.now(), genTime, rows: generated, stats }
    setRows(generated)
    setPlugins([
      // Hierarchical rows (parent "code" groups -> resource children).
      createTree().plugin,
      // Code is the second column, and hosts the tree chevron via `treeColumn`.
      // Columns are resizable (drag a header edge) and widths persist in localStorage.
      createColumns({
        sidebarWidth: 260,
        treeColumn: 'id',
        persistWidths: 'ganttkit-stress-columns-react',
        columns: [{ key: 'name', label: 'Name' }, { key: 'id', label: 'Code' }],
      }).plugin,
      filter.plugin,
    ])
    setRunId(id => id + 1)
  }, [])

  const onReady = useCallback((engine: GanttEngine) => {
    const started = pending.current
    if (!started)
      return
    pending.current = null
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
    const filter = filterRef.current!
    const filterOn = time(() => filter.setTaskFilter(filters.taskNameIncludes('task 1')))
    const filterOff = time(() => filter.clear())

    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    setMetrics({
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
  }, [])

  // Initial run.
  useEffect(() => {
    run(INITIAL_SIZE)
  }, [run])

  return (
    <>
      <header>
        <strong>GanttKit | React stress test</strong>
        <label>
          Dataset
          <select value={size} onChange={e => setSize(e.target.value)}>
            {SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button onClick={() => run(size)}>Run benchmark</button>
        <input
          type="search"
          value={query}
          placeholder="Filter tasks..."
          onChange={(e) => {
            const q = e.target.value
            setQuery(q)
            filterRef.current?.setTaskFilter(q.trim() ? filters.taskNameIncludes(q.trim()) : null)
          }}
        />
        <span style={{ color: '#6b7280' }}>drag | ctrl+wheel zoom | drag empty space to pan</span>
      </header>

      <div className="wrap">
        <div className="metrics">
          {metrics && (
            <>
              <table>
                <caption>Dataset</caption>
                <tbody>
                  <tr><td>Rows</td><td>{num(metrics.rows)}</td></tr>
                  <tr><td>Tasks</td><td>{num(metrics.tasks)}</td></tr>
                  <tr><td>Dependencies</td><td>{num(metrics.dependencies)}</td></tr>
                  <tr><td>Milestones</td><td>{num(metrics.milestones)}</td></tr>
                  <tr><td>Scene primitives (visible)</td><td>{num(metrics.primitives)}</td></tr>
                  <tr><td>HTML DOM nodes (visible)</td><td>{num(metrics.domNodes)}</td></tr>
                </tbody>
              </table>
              <table style={{ marginTop: 12 }}>
                <caption>Timings</caption>
                <tbody>
                  <tr><td>Generate data</td><td>{ms(metrics.genTime)}</td></tr>
                  <tr><td>Mount (render + compute + paint)</td><td className={cls(metrics.mount)}>{ms(metrics.mount)}</td></tr>
                  <tr><td>Full scene build (CPU)</td><td className={cls(metrics.cpuBuild)}>{ms(metrics.cpuBuild)} | {rate(metrics.cpuBuild)}</td></tr>
                  <tr><td>-&gt; Month (recompute+paint)</td><td className={cls(metrics.vMonth)}>{ms(metrics.vMonth)}</td></tr>
                  <tr><td>-&gt; Day (recompute+paint)</td><td className={cls(metrics.vDay)}>{ms(metrics.vDay)}</td></tr>
                  <tr><td>-&gt; Week (recompute+paint)</td><td className={cls(metrics.vWeek)}>{ms(metrics.vWeek)}</td></tr>
                  <tr><td>Apply filter</td><td className={cls(metrics.filterOn)}>{ms(metrics.filterOn)}</td></tr>
                  <tr><td>Clear filter</td><td className={cls(metrics.filterOff)}>{ms(metrics.filterOff)}</td></tr>
                  {metrics.heapMb != null && <tr><td>JS heap used</td><td>{metrics.heapMb.toFixed(0)} MB</td></tr>}
                </tbody>
              </table>
              <p className="note">
                green &lt; 16 ms (60 fps) | amber &lt; 50 ms | red &gt;= 50 ms.
                {metrics.heapMb == null && <> Run Chromium with <code>--enable-precise-memory-info</code> for heap stats.</>}
              </p>
            </>
          )}
        </div>

        <GanttChart
          key={runId}
          className="chart"
          rows={rows}
          plugins={plugins}
          chevron={CHEVRON}
          onReady={onReady}
        />
      </div>
    </>
  )
}
