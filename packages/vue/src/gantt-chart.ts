import type { PropType } from 'vue'
import { defineComponent, h, ref } from 'vue'
import type {
  ChevronOption,
  DateAdapter,
  DateInput,
  GanttEngine,
  GanttPlugin,
  GanttRow,
  RendererFactory,
  TaskDragEvent,
  TaskHoverEvent,
  TaskPointerEvent,
  ViewMode,
} from '@ganttkit/core'
import { useGantt } from './use-gantt'

/**
 * Renders a GanttKit chart into its own root element.
 *
 * ```vue
 * <GanttChart v-model:view-mode="mode" :rows="rows" :plugins="plugins" style="height: 70vh" />
 * ```
 *
 * Paints with the HTML renderer by default; pass `:renderer="svgRenderer"` or
 * `:renderer="canvasRenderer"` (plus that package's stylesheet) to switch.
 *
 * The component owns one engine. `rows`, `view-mode`, `theme` and
 * `date-adapter` are applied to the live engine; any other option is only read
 * when the engine is built, so changing it rebuilds the chart. Attributes fall
 * through to the root element, which needs a height to be visible.
 */
export const GanttChart = defineComponent({
  name: 'GanttChart',
  props: {
    /** Rows to display. Swap the array to publish new data. */
    rows: { type: Array as PropType<GanttRow[]>, default: () => [] },
    /** Timeline granularity. Supports `v-model:view-mode`. */
    viewMode: { type: String as PropType<ViewMode>, default: undefined },
    /** `light` (default) or `dark`. */
    theme: { type: String as PropType<'light' | 'dark'>, default: undefined },
    /** Force a timeline start. Derived from the task dates when omitted. */
    startDate: { type: [Date, String, Number] as PropType<DateInput | null>, default: undefined },
    /** Force a timeline end. Derived from the task dates when omitted. */
    endDate: { type: [Date, String, Number] as PropType<DateInput | null>, default: undefined },
    rowHeight: { type: Number, default: undefined },
    /** Base px-per-day at `Week` view; other view modes scale it. */
    dayWidth: { type: Number, default: undefined },
    barPadding: { type: Number, default: undefined },
    highlightToday: { type: Boolean, default: undefined },
    draggable: { type: Boolean, default: undefined },
    /** Render only what the viewport shows. Default `true`. */
    virtualize: { type: Boolean, default: undefined },
    overscanRows: { type: Number, default: undefined },
    overscanCols: { type: Number, default: undefined },
    /** Swap to relocalize dates without rebuilding the chart. */
    dateAdapter: { type: Object as PropType<DateAdapter>, default: undefined },
    /** ctrl/cmd + wheel changes the view mode. Default `true`. */
    enableZoom: { type: Boolean, default: undefined },
    /** Click-drag the chart body to pan. Default `true`. */
    enablePan: { type: Boolean, default: undefined },
    /**
     * Base renderer: `htmlRenderer` (the default), `svgRenderer` or
     * `canvasRenderer`. Import the matching stylesheet for the one you pick.
     * Read once, when the engine is built.
     */
    renderer: { type: Function as PropType<RendererFactory>, default: undefined },
    /** Custom tree chevron. Read once, when the engine is built. */
    chevron: { type: [Object, Function] as PropType<ChevronOption>, default: undefined },
    /** Feature plugins. Read once, when the engine is built. */
    plugins: { type: Array as PropType<GanttPlugin[]>, default: undefined },
  },
  emits: {
    /** The engine is live - install more plugins or keep a reference. */
    ready: (engine: GanttEngine) => !!engine,
    'update:viewMode': (viewMode: ViewMode) => !!viewMode,
    taskClick: (payload: TaskPointerEvent) => !!payload,
    taskDblclick: (payload: TaskPointerEvent) => !!payload,
    taskHover: (payload: TaskHoverEvent) => !!payload,
    taskHoverend: () => true,
    taskDragstart: (payload: { task: TaskPointerEvent['task'], row: GanttRow, mode: TaskDragEvent['mode'] }) => !!payload,
    taskDragmove: (payload: TaskDragEvent) => !!payload,
    taskDragend: (payload: TaskDragEvent) => !!payload,
    viewModeChange: (payload: { viewMode: ViewMode }) => !!payload,
    dateRangeChange: (payload: { start: Date, end: Date }) => !!payload,
    rowsChange: (payload: { rows: GanttRow[] }) => !!payload,
    selectionChange: (payload: { taskId: string | null }) => true,
    rowToggle: (payload: { rowId: string }) => !!payload,
  },
  setup(props, { emit, expose }) {
    const el = ref<HTMLElement | null>(null)

    const { engine } = useGantt(el, () => ({ ...props }), {
      onCreated(created) {
        // `scene:change` is deliberately not re-emitted: it fires on every
        // scroll frame. Reach for `engine.events` when you need it.
        created.events.on('task:click', p => emit('taskClick', p))
        created.events.on('task:dblclick', p => emit('taskDblclick', p))
        created.events.on('task:hover', p => emit('taskHover', p))
        created.events.on('task:hoverend', () => emit('taskHoverend'))
        created.events.on('task:dragstart', p => emit('taskDragstart', p))
        created.events.on('task:dragmove', p => emit('taskDragmove', p))
        created.events.on('task:dragend', p => emit('taskDragend', p))
        created.events.on('daterange:change', p => emit('dateRangeChange', p))
        created.events.on('rows:change', p => emit('rowsChange', p))
        created.events.on('selection:change', p => emit('selectionChange', p))
        created.events.on('row:toggle', p => emit('rowToggle', p))
        created.events.on('viewmode:change', (p) => {
          emit('viewModeChange', p)
          emit('update:viewMode', p.viewMode)
        })
        emit('ready', created)
      },
    })

    expose({ engine })

    return () => h('div', { ref: el })
  },
})
