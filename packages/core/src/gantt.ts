import type {
  DateInput,
  GanttOptions,
  GanttRow,
  ResolvedGanttOptions,
  ViewMode,
} from './types'
import type {
  GanttContext,
  GanttEngineApi,
  GanttEventMap,
  GanttHooks,
  GanttPlugin,
  GanttState,
  SceneChangeReason,
  SceneHookContext,
} from './engine-types'
import { type DateAdapter, defaultDateAdapter } from './time/date-adapter'
import { TimeScale, deriveDateRange } from './time/time-scale'
import { computeTaskLayouts } from './layout/layout-engine'
import { computeDependencyLinks } from './layout/dependencies'
import { buildScene } from './scene/scene-builder'
import type { Scene } from './scene/scene-types'
import { type GanttHit, hitTestRegion, hitTestScene } from './scene/hit-test'
import { type SceneWindow, type Viewport, resolveWindow, sameViewport } from './scene/viewport'
import { Store } from './state/store'
import { EventBus } from './plugin/event-bus'
import { CommandRegistry } from './plugin/commands'
import { ServiceRegistry } from './plugin/service-registry'
import { UiRegistry } from './plugin/ui-registry'
import { Hook } from './plugin/hooks'
import { PluginHost } from './plugin/plugin-host'

const DEFAULTS = {
  viewMode: 'Week' as ViewMode,
  rowHeight: 50,
  dayWidth: 60,
  barPadding: 6,
  highlightToday: true,
  draggable: true,
  virtualize: true,
  overscanRows: 4,
  overscanCols: 6,
}

function resolveOptions(options: GanttOptions): ResolvedGanttOptions {
  return {
    rows: options.rows ?? [],
    viewMode: options.viewMode ?? DEFAULTS.viewMode,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
    rowHeight: options.rowHeight ?? DEFAULTS.rowHeight,
    dayWidth: options.dayWidth ?? DEFAULTS.dayWidth,
    barPadding: options.barPadding ?? DEFAULTS.barPadding,
    highlightToday: options.highlightToday ?? DEFAULTS.highlightToday,
    draggable: options.draggable ?? DEFAULTS.draggable,
    virtualize: options.virtualize ?? DEFAULTS.virtualize,
    overscanRows: options.overscanRows ?? DEFAULTS.overscanRows,
    overscanCols: options.overscanCols ?? DEFAULTS.overscanCols,
    dateAdapter: options.dateAdapter ?? defaultDateAdapter,
  }
}

/**
 * The GanttKit engine  headless and framework-agnostic.
 *
 * Holds the reactive state, runs the compute pipeline
 * (hooks → time-scale → layout → dependencies → scene → scene hook), hosts
 * plugins, and publishes a {@link Scene} for renderers. It never touches the DOM.
 *
 * Typical use: `new GanttEngine(opts).use(renderPlugin).use(featurePlugin)`.
 */
export class GanttEngine implements GanttEngineApi {
  readonly store: Store<GanttState>
  readonly events = new EventBus<GanttEventMap>()
  readonly commands = new CommandRegistry()
  readonly services = new ServiceRegistry()
  readonly ui = new UiRegistry()
  readonly hooks: GanttHooks = {
    rows: new Hook<GanttRow[]>(),
    scene: new Hook<Scene, SceneHookContext>(),
  }

  private options: ResolvedGanttOptions
  private readonly host: PluginHost

  // Heavy compute outputs (rebuilt by `recompute()` on data/view change).
  private timeScale!: TimeScale
  private computedRows: GanttRow[] = []

  // Cheap windowed outputs (rebuilt by `rebuildScene()` on scroll/preview).
  private scene!: Scene
  private viewport: Viewport | null = null
  private window: SceneWindow | null = null
  private dragPreview: { taskId: string, start: DateInput, end: DateInput } | null = null

  constructor(options: GanttOptions = {}) {
    this.options = resolveOptions(options)
    this.store = new Store<GanttState>({
      rows: this.options.rows,
      viewMode: this.options.viewMode,
      selectedTaskId: null,
      loading: false,
    })

    const context: GanttContext = {
      store: this.store,
      events: this.events,
      commands: this.commands,
      services: this.services,
      ui: this.ui,
      hooks: this.hooks,
      engine: this,
    }
    this.host = new PluginHost(context)

    this.recompute()
  }

  // --- Plugin lifecycle ---------------------------------------------------

  /** Install a plugin. Chainable. */
  use(plugin: GanttPlugin): this {
    this.host.use(plugin)
    this.recompute()
    return this
  }

  hasPlugin(name: string): boolean {
    return this.host.has(name)
  }

  removePlugin(name: string): void {
    this.host.remove(name)
    this.recompute()
  }

  // --- State accessors ----------------------------------------------------

  getState(): Readonly<GanttState> {
    return this.store.get()
  }

  getOptions(): ResolvedGanttOptions {
    return this.options
  }

  getTimeScale(): TimeScale {
    return this.timeScale
  }

  getScene(): Scene {
    return this.scene
  }

  /**
   * Hit-test a point (in scene coordinates) against the current scene, returning
   * the task and resize handle under it, or `null`. The single source of truth
   * for "what's under the pointer" so renderers never re-implement hit geometry.
   */
  hitTest(x: number, y: number): GanttHit | null {
    return hitTestScene(this.scene, x, y)
  }

  /**
   * Task ids whose bars intersect a scene-coordinate rectangle, for rubber-band
   * selection. Like {@link hitTest}, the geometry lives here so no renderer or
   * plugin re-implements it.
   */
  hitTestRegion(x1: number, y1: number, x2: number, y2: number): string[] {
    return hitTestRegion(this.scene, x1, y1, x2, y2)
  }

  /** Rows after the `rows` hook (what renderers should display). */
  getRows(): GanttRow[] {
    return this.computedRows
  }

  /** Publish a capability for renderers/plugins to consume. */
  provide<T>(key: string, service: T): () => void {
    return this.services.provide(key, service)
  }

  /** Look up a capability published by a plugin, or `undefined`. */
  consume<T>(key: string): T | undefined {
    return this.services.consume<T>(key)
  }

  /** The window resolved for the current viewport, or `null` when not virtualizing. */
  getWindow(): SceneWindow | null {
    return this.window
  }

  /** Subscribe to scene updates. Returns an unsubscribe function. */
  onSceneChange(listener: (scene: Scene) => void): () => void {
    return this.events.on('scene:change', ({ scene }) => listener(scene))
  }

  // --- Mutations ----------------------------------------------------------

  setRows(rows: GanttRow[]): void {
    this.store.set({ rows })
    this.recompute()
    this.events.emit('rows:change', { rows })
  }

  setViewMode(viewMode: ViewMode): void {
    if (viewMode === this.store.get().viewMode)
      return
    this.store.set({ viewMode })
    this.recompute()
    this.events.emit('viewmode:change', { viewMode })
  }

  /** Swap the date adapter (e.g. to change locale) and recompute. */
  setDateAdapter(adapter: DateAdapter): void {
    this.options = { ...this.options, dateAdapter: adapter }
    this.recompute()
  }

  /** Report the visible region. Triggers a cheap windowed rebuild (no recompute). */
  setViewport(viewport: Viewport | null): void {
    if (sameViewport(this.viewport, viewport))
      return
    this.viewport = viewport
    if (this.options.virtualize)
      this.rebuildScene('viewport')
  }

  /** Show a transient drag/resize preview without committing to state. */
  setDragPreview(taskId: string, start: DateInput, end: DateInput): void {
    this.dragPreview = { taskId, start, end }
    this.rebuildScene('preview')
  }

  /** Remove any active drag preview and repaint committed state. */
  clearDragPreview(): void {
    if (!this.dragPreview)
      return
    this.dragPreview = null
    this.rebuildScene('preview')
  }

  setLoading(loading: boolean): void {
    this.store.set({ loading })
  }

  selectTask(taskId: string | null): void {
    if (taskId === this.store.get().selectedTaskId)
      return
    this.store.set({ selectedTaskId: taskId })
    this.events.emit('selection:change', { taskId })
  }

  /** Patch a single task and recompute. Returns `true` if the task was found. */
  updateTask(taskId: string, patch: Partial<GanttRow['tasks'][number]>): boolean {
    let found = false
    const rows = this.store.get().rows.map(row => ({
      ...row,
      tasks: row.tasks.map((task) => {
        if (task.id !== taskId)
          return task
        found = true
        return { ...task, ...patch }
      }),
    }))
    if (found)
      this.setRows(rows)
    return found
  }

  /** Convenience for committing a drag/resize result. */
  updateTaskDates(taskId: string, start: DateInput, end: DateInput): boolean {
    return this.updateTask(taskId, { start, end })
  }

  /** Re-run the full compute pipeline and notify renderers. */
  refresh(): void {
    this.recompute()
  }

  /** Tear down plugins and listeners. */
  destroy(): void {
    this.host.destroy()
    this.events.clear()
  }

  // --- Compute pipeline ---------------------------------------------------

  /**
   * Heavy pass: run the `rows` hook, derive the date range (one O(tasks) scan),
   * and rebuild the time scale. Followed by a windowed scene build. Called on
   * data/view-mode/plugin changes  never on scroll.
   */
  private recompute(): void {
    const state = this.store.get()
    const adapter = this.options.dateAdapter
    const today = adapter.startOfDay(new Date())

    const rows = this.hooks.rows.run(state.rows, undefined)
    this.computedRows = rows

    const { start, end } = deriveDateRange(
      rows,
      this.options.startDate ? adapter.parse(this.options.startDate) : null,
      this.options.endDate ? adapter.parse(this.options.endDate) : null,
      adapter,
      today,
    )

    this.timeScale = new TimeScale({
      start,
      end,
      viewMode: state.viewMode,
      baseDayWidth: this.options.dayWidth,
      adapter,
      today,
    })

    this.rebuildScene('data')
    this.events.emit('daterange:change', { start, end })
  }

  /**
   * Cheap pass: lay out and build the scene for the current viewport only
   * (plus overscan), applying any drag preview. O(visible rows + days), so it
   * stays fast on scroll regardless of dataset size.
   */
  private rebuildScene(reason: SceneChangeReason): void {
    const rows = this.computedRows
    const scale = this.timeScale
    const opts = this.options
    const adapter = opts.dateAdapter

    const window: SceneWindow | null = opts.virtualize && this.viewport
      ? resolveWindow(this.viewport, scale, {
        rowCount: rows.length,
        rowHeight: opts.rowHeight,
        overscanRows: opts.overscanRows,
        overscanCols: opts.overscanCols,
      })
      : null
    this.window = window

    const baseIndex = window ? window.rowStart : 0
    const sliceRows = window ? rows.slice(window.rowStart, window.rowEnd) : rows
    const effectiveRows = this.applyDragPreview(sliceRows)

    let layouts = computeTaskLayouts(effectiveRows, scale, opts.rowHeight, opts.barPadding, adapter, undefined, baseIndex)
    if (window) {
      const xMin = window.dayStart * scale.dayWidth
      const xMax = window.dayEnd * scale.dayWidth
      layouts = layouts.filter(l => l.x + l.width >= xMin && l.x <= xMax)
    }

    const links = computeDependencyLinks(layouts)
    const baseScene = buildScene({ rowCount: rows.length, scale, layouts, links, options: opts, window: window ?? undefined })
    this.scene = this.hooks.scene.run(baseScene, { scale, layouts, options: opts })

    this.events.emit('scene:change', { scene: this.scene, reason })
  }

  /** Override the dragged task's dates in a row slice, leaving others untouched. */
  private applyDragPreview(rows: GanttRow[]): GanttRow[] {
    const preview = this.dragPreview
    if (!preview)
      return rows
    return rows.map((row) => {
      if (!row.tasks.some(t => t.id === preview.taskId))
        return row
      return {
        ...row,
        tasks: row.tasks.map(t => (t.id === preview.taskId ? { ...t, start: preview.start, end: preview.end } : t)),
      }
    })
  }
}
