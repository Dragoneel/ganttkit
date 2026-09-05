import type { OnDestroy, Signal } from '@angular/core'
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core'
import type {
  DateAdapter,
  DateInput,
  GanttEngine,
  GanttPlugin,
  GanttRow,
  TaskDragEvent,
  TaskHoverEvent,
  TaskPointerEvent,
  ViewMode,
} from '@ganttkit/core'
import type { ChevronOption } from '@ganttkit/html'
import type { GanttChartOptions } from './engine.js'
import { createEngine, rebuildKey, syncRows, syncTheme, syncViewMode } from './engine.js'

/**
 * Renders a GanttKit chart into its own host element.
 *
 * ```html
 * <gantt-chart [rows]="rows()" viewMode="Week" (taskClick)="onClick($event)" />
 * ```
 *
 * The component owns one engine. `rows`, `viewMode`, `theme` and `dateAdapter`
 * are applied to the live engine; any other input is only read when the engine
 * is built, so changing it rebuilds the chart. The host is `display: block` and
 * needs a height to be visible.
 */
@Component({
  selector: 'gantt-chart',
  template: '',
  styles: ':host { display: block; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GanttChartComponent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  /** Rows to display. Swap the array to publish new data. */
  readonly rows = input<GanttRow[]>([])
  /** Timeline granularity. Default `Week`. */
  readonly viewMode = input<ViewMode>()
  /** `light` (default) or `dark`. */
  readonly theme = input<'light' | 'dark'>()
  /** Force a timeline start. Derived from the task dates when omitted. */
  readonly startDate = input<DateInput | null>()
  /** Force a timeline end. Derived from the task dates when omitted. */
  readonly endDate = input<DateInput | null>()
  readonly rowHeight = input<number>()
  /** Base px-per-day at `Week` view; other view modes scale it. */
  readonly dayWidth = input<number>()
  readonly barPadding = input<number>()
  readonly highlightToday = input<boolean>()
  readonly draggable = input<boolean>()
  /** Render only what the viewport shows. Default `true`. */
  readonly virtualize = input<boolean>()
  readonly overscanRows = input<number>()
  readonly overscanCols = input<number>()
  /** Swap to relocalize dates without rebuilding the chart. */
  readonly dateAdapter = input<DateAdapter>()
  /** ctrl/cmd + wheel changes the view mode. Default `true`. */
  readonly enableZoom = input<boolean>()
  /** Click-drag the chart body to pan. Default `true`. */
  readonly enablePan = input<boolean>()
  /** Custom tree chevron. Read once, when the engine is built. */
  readonly chevron = input<ChevronOption>()
  /** Feature plugins. Read once, when the engine is built. */
  readonly plugins = input<GanttPlugin[]>()

  /** The engine is live - install more plugins or keep a reference. */
  readonly ready = output<GanttEngine>()
  readonly taskClick = output<TaskPointerEvent>()
  readonly taskDblClick = output<TaskPointerEvent>()
  readonly taskHover = output<TaskHoverEvent>()
  readonly taskHoverEnd = output<void>()
  readonly taskDragStart = output<{ task: TaskPointerEvent['task'], row: GanttRow, mode: TaskDragEvent['mode'] }>()
  readonly taskDragMove = output<TaskDragEvent>()
  readonly taskDragEnd = output<TaskDragEvent>()
  readonly viewModeChange = output<{ viewMode: ViewMode }>()
  readonly dateRangeChange = output<{ start: Date, end: Date }>()
  readonly rowsChange = output<{ rows: GanttRow[] }>()
  readonly selectionChange = output<{ taskId: string | null }>()
  readonly rowToggle = output<{ rowId: string }>()

  private readonly engineSignal = signal<GanttEngine | null>(null)
  /** The live engine, or `null` before the first sync / after destroy. */
  readonly engine: Signal<GanttEngine | null> = this.engineSignal.asReadonly()

  /** The options the engine and renderer only read when they are constructed. */
  private readonly buildOptions = computed<GanttChartOptions>(() => ({
    rowHeight: this.rowHeight(),
    dayWidth: this.dayWidth(),
    barPadding: this.barPadding(),
    highlightToday: this.highlightToday(),
    draggable: this.draggable(),
    virtualize: this.virtualize(),
    overscanRows: this.overscanRows(),
    overscanCols: this.overscanCols(),
    startDate: this.startDate(),
    endDate: this.endDate(),
    enableZoom: this.enableZoom(),
    enablePan: this.enablePan(),
  }))

  private readonly buildKey = computed(() => rebuildKey(this.buildOptions()))

  constructor() {
    // Only the construction-time inputs are tracked here; the rest sync below.
    effect(() => {
      this.buildKey()
      untracked(() => this.rebuild())
    })

    effect(() => {
      const rows = this.rows()
      untracked(() => {
        const engine = this.engineSignal()
        if (engine)
          syncRows(engine, rows)
      })
    })

    effect(() => {
      const viewMode = this.viewMode()
      untracked(() => {
        const engine = this.engineSignal()
        if (engine)
          syncViewMode(engine, viewMode)
      })
    })

    effect(() => {
      syncTheme(this.host.nativeElement, this.theme())
    })

    effect(() => {
      const adapter = this.dateAdapter()
      untracked(() => {
        const engine = this.engineSignal()
        if (adapter && engine)
          engine.setDateAdapter(adapter)
      })
    })
  }

  ngOnDestroy(): void {
    this.teardown()
  }

  private rebuild(): void {
    this.teardown()
    const created = createEngine(this.host.nativeElement, {
      ...this.buildOptions(),
      rows: this.rows(),
      viewMode: this.viewMode(),
      theme: this.theme(),
      dateAdapter: this.dateAdapter(),
      chevron: this.chevron(),
      plugins: this.plugins(),
    })

    // `scene:change` is deliberately not forwarded: it fires on every scroll
    // frame. Reach for `engine.events` when you need it.
    created.events.on('task:click', p => this.taskClick.emit(p))
    created.events.on('task:dblclick', p => this.taskDblClick.emit(p))
    created.events.on('task:hover', p => this.taskHover.emit(p))
    created.events.on('task:hoverend', () => this.taskHoverEnd.emit())
    created.events.on('task:dragstart', p => this.taskDragStart.emit(p))
    created.events.on('task:dragmove', p => this.taskDragMove.emit(p))
    created.events.on('task:dragend', p => this.taskDragEnd.emit(p))
    created.events.on('viewmode:change', p => this.viewModeChange.emit(p))
    created.events.on('daterange:change', p => this.dateRangeChange.emit(p))
    created.events.on('rows:change', p => this.rowsChange.emit(p))
    created.events.on('selection:change', p => this.selectionChange.emit(p))
    created.events.on('row:toggle', p => this.rowToggle.emit(p))

    this.engineSignal.set(created)
    this.ready.emit(created)
  }

  // `destroy()` tears down the plugins, so the renderer empties the host and
  // the engine's event bus is cleared - nothing else to unsubscribe.
  private teardown(): void {
    this.engineSignal()?.destroy()
    this.engineSignal.set(null)
  }
}
