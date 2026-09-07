import type { PropType, Ref } from 'vue'
import { computed, defineComponent, h, ref } from 'vue'
import type {
  ChevronOption,
  DateAdapter,
  DateInput,
  GanttEngine,
  GanttPlugin,
  GanttRow,
  RendererFactory,
  ViewMode,
} from '@ganttkit/core'
import { GanttChart as BaseGanttChart } from '@ganttkit/vue'
import { defaults, renderer } from '#ganttkit-options'

/** The exposed surface of `@ganttkit/vue`'s component, after ref unwrapping. */
interface BaseExposed {
  engine: GanttEngine | null
}

/**
 * The auto-imported chart component - `<GanttChart>` unless `ganttkit.prefix`
 * renames it - the same component `@ganttkit/vue` ships, with the module's
 * `nuxt.config` wired in.
 *
 * Two things are added on top of the Vue binding, and nothing else:
 *
 * - every serializable option in `ganttkit.defaults` becomes this component's
 *   prop default, so a prop you do not pass falls back to `nuxt.config`
 *   instead of to the engine's built-in;
 * - `renderer` defaults to the factory for `ganttkit.renderer`, statically
 *   imported by the generated module so only the chosen renderer is bundled.
 *
 * Events, slots and attributes are forwarded untouched: no `emits` are declared
 * here, so every `@task-click`-style listener arrives in `attrs` and is handed
 * straight to the binding. One less list to keep in sync.
 *
 * ```vue
 * <template>
 *   <GanttChart v-model:view-mode="mode" :rows="rows" style="height: 70vh" />
 * </template>
 * ```
 *
 * Server-side the root element renders empty - the chart is painted by a DOM
 * renderer, so it needs a client. Give it a height and the layout is reserved
 * before hydration, so nothing shifts when the engine takes over.
 */
export default defineComponent({
  name: 'GanttChart',
  // The base component is this one's only root, so Vue would forward attrs to
  // it on its own; the render below passes them explicitly instead, which
  // keeps them from being applied twice.
  inheritAttrs: false,
  props: {
    /** Rows to display. Swap the array to publish new data. */
    rows: { type: Array as PropType<GanttRow[]>, default: () => [] },
    /** Timeline granularity. Supports `v-model:view-mode`. */
    viewMode: { type: String as PropType<ViewMode>, default: () => defaults.viewMode },
    /** `light` (default) or `dark`. */
    theme: { type: String as PropType<'light' | 'dark'>, default: () => defaults.theme },
    /** Force a timeline start. Derived from the task dates when omitted. */
    startDate: { type: [Date, String, Number] as PropType<DateInput | null>, default: () => defaults.startDate },
    /** Force a timeline end. Derived from the task dates when omitted. */
    endDate: { type: [Date, String, Number] as PropType<DateInput | null>, default: () => defaults.endDate },
    rowHeight: { type: Number, default: () => defaults.rowHeight },
    /** Base px-per-day at `Week` view; other view modes scale it. */
    dayWidth: { type: Number, default: () => defaults.dayWidth },
    barPadding: { type: Number, default: () => defaults.barPadding },
    highlightToday: { type: Boolean, default: () => defaults.highlightToday },
    draggable: { type: Boolean, default: () => defaults.draggable },
    /** Render only what the viewport shows. Default `true`. */
    virtualize: { type: Boolean, default: () => defaults.virtualize },
    overscanRows: { type: Number, default: () => defaults.overscanRows },
    overscanCols: { type: Number, default: () => defaults.overscanCols },
    /** Swap to relocalize dates without rebuilding the chart. */
    dateAdapter: { type: Object as PropType<DateAdapter>, default: undefined },
    /** ctrl/cmd + wheel changes the view mode. Default `true`. */
    enableZoom: { type: Boolean, default: () => defaults.enableZoom },
    /** Click-drag the chart body to pan. Default `true`. */
    enablePan: { type: Boolean, default: () => defaults.enablePan },
    /**
     * Base renderer. Defaults to the factory for `ganttkit.renderer` in
     * `nuxt.config`; pass one here to override it for a single chart, and
     * import that package's stylesheet yourself.
     *
     * Vue hands a `Function`-typed prop its `default` as the value rather than
     * calling it as a factory, so this is the factory itself, not a getter.
     */
    renderer: { type: Function as PropType<RendererFactory>, default: renderer },
    /** Custom tree chevron. Read once, when the engine is built. */
    chevron: { type: [Object, Function] as PropType<ChevronOption>, default: undefined },
    /** Feature plugins. Read once, when the engine is built. */
    plugins: { type: Array as PropType<GanttPlugin[]>, default: undefined },
  },
  setup(props, { attrs, slots, expose }) {
    const base = ref(null) as Ref<BaseExposed | null>

    // Mirrors what `@ganttkit/vue` exposes, so a template ref reads the same
    // either way: `chart.value?.engine?.events.on(...)`.
    const engine = computed<GanttEngine | null>(() => base.value?.engine ?? null)
    expose({ engine })

    return () => h(BaseGanttChart, { ...props, ...attrs, ref: base }, slots)
  },
})
