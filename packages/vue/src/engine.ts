import type {
  ChevronOption,
  DateInput,
  GanttOptions,
  GanttPlugin,
  GanttRow,
  RendererFactory,
  ViewMode,
} from '@ganttkit/core'
import { GanttEngine } from '@ganttkit/core'
import { htmlRenderer } from '@ganttkit/html'

/**
 * Everything the wrapper accepts: the headless engine options, the base
 * renderer's own options, and the feature plugins to install on top.
 *
 * Nothing here is framework-specific - the component and the composable/hook
 * in this package are thin bindings over these helpers.
 */
export interface GanttChartOptions extends GanttOptions {
  /**
   * Base renderer to paint with: `htmlRenderer` (the default),
   * `svgRenderer` or `canvasRenderer`. Anything matching `RendererFactory`
   * works, so a custom renderer drops in the same way.
   *
   * Each renderer ships its own stylesheet - import the one you pick.
   */
  renderer?: RendererFactory
  /** Initial theme. Kept in sync with the root element's `data-theme`. */
  theme?: 'light' | 'dark'
  /** Enable ctrl/cmd + wheel to change view mode. Default `true`. */
  enableZoom?: boolean
  /** Enable click-drag panning of the chart body. Default `true`. */
  enablePan?: boolean
  /** Custom tree expand/collapse chevron. Read once, when the engine is built. */
  chevron?: ChevronOption
  /** Feature plugins, installed after the renderer. Read once, when the engine is built. */
  plugins?: GanttPlugin[]
}

/** Build an engine, attach the chosen renderer to `target`, install the plugins. */
export function createEngine(target: HTMLElement, options: GanttChartOptions): GanttEngine {
  const { renderer = htmlRenderer, theme, enableZoom, enablePan, chevron, plugins, ...engineOptions } = options
  const engine = new GanttEngine(engineOptions)
  engine.use(renderer({ target, theme, enableZoom, enablePan, chevron }))
  for (const plugin of plugins ?? [])
    engine.use(plugin)
  return engine
}

/**
 * Identity of the options the engine and renderer only read at construction
 * time. When this string changes the wrapper tears the engine down and builds a
 * fresh one; `rows`, `viewMode`, `theme` and `dateAdapter` are applied in place
 * instead, and `plugins`/`chevron` are read once per engine.
 */
export function rebuildKey(options: GanttChartOptions): string {
  return JSON.stringify([
    identityKey(options.renderer),
    options.rowHeight,
    options.dayWidth,
    options.barPadding,
    options.highlightToday,
    options.draggable,
    options.virtualize,
    options.overscanRows,
    options.overscanCols,
    dateKey(options.startDate),
    dateKey(options.endDate),
    options.enableZoom,
    options.enablePan,
  ])
}

function dateKey(value: DateInput | null | undefined): string | number | null {
  if (value == null)
    return null
  return value instanceof Date ? value.getTime() : value
}

/**
 * Stable ids for build options JSON cannot represent. `JSON.stringify` turns a
 * function into `null`, so without this the renderer would be invisible to the
 * key and swapping it would leave the old renderer painting.
 *
 * Weak, so keeping an id costs nothing once the value is unreachable.
 */
const identities = new WeakMap<object, number>()
let nextIdentity = 0

function identityKey(value: object | null | undefined): number | null {
  if (value == null)
    return null
  let id = identities.get(value)
  if (id === undefined) {
    id = ++nextIdentity
    identities.set(value, id)
  }
  return id
}

/** Push `rows` into the engine, skipping the recompute when they are unchanged. */
export function syncRows(engine: GanttEngine, rows: GanttRow[] | undefined): void {
  const next = rows ?? []
  if (engine.getState().rows !== next)
    engine.setRows(next)
}

/**
 * Push `viewMode` into the engine. Guarded, because the engine also changes the
 * view mode on its own (toolbar plugin, ctrl+wheel) and echoes it back out.
 */
export function syncViewMode(engine: GanttEngine, viewMode: ViewMode | undefined): void {
  if (viewMode && engine.getState().viewMode !== viewMode)
    engine.setViewMode(viewMode)
}

/** The renderer reads the theme from `data-theme`, so a swap is one attribute. */
export function syncTheme(target: HTMLElement, theme: 'light' | 'dark' | undefined): void {
  target.setAttribute('data-theme', theme ?? 'light')
}
