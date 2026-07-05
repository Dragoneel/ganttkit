/**
 * Core domain types for GanttKit.
 *
 * These are intentionally framework-agnostic and serialisable: a task or row is
 * plain data, never a class instance, so it can cross network/worker boundaries.
 */

/** A point in time accepted on input. Normalised to a `Date` internally. */
export type DateInput = Date | string | number

/** Built-in timeline granularities. */
export type ViewMode = 'Day' | 'Week' | 'Month'

/** Discriminates how a task is drawn. */
export type TaskKind = 'task' | 'milestone'

/**
 * A single schedulable item placed on a row.
 *
 * `start`/`end` are inclusive day boundaries. For a milestone, `end` marks the
 * point the marker is drawn at.
 */
export interface GanttTask {
  id: string
  name: string
  start: DateInput
  end: DateInput
  /** Completion ratio in `[0, 1]`. Optional; renderers may show a fill. */
  progress?: number
  /** `'task'` (default) renders a bar; `'milestone'` renders a marker. */
  kind?: TaskKind
  /** IDs of tasks this task depends on (drawn as incoming links). */
  dependencies?: string[]
  /** Extra space-separated CSS class(es) applied to the rendered primitive. */
  className?: string
  /** Tooltip text; falls back to `name`. */
  tooltip?: string
  /** Whether the bar can be dragged/resized. Defaults to engine option. */
  draggable?: boolean
  /** Arbitrary consumer payload, never touched by the engine. */
  meta?: Record<string, unknown>
}

/**
 * A horizontal lane. Rows carry their own tasks so the data shape mirrors the
 * visual layout and supports resource- or task-oriented Gantts alike.
 */
export interface GanttRow {
  id: string
  name: string
  tasks: GanttTask[]
  /** Indentation level for hierarchical (tree) layouts. */
  level?: number
  /** Whether this row has collapsible children (drives the toggle affordance). */
  hasChildren?: boolean
  /** Current expanded state for tree rows. */
  expanded?: boolean
  /** Parent row id, for tree relationships. */
  parentId?: string
  meta?: Record<string, unknown>
}

/** Engine configuration. All fields optional; sensible defaults applied. */
export interface GanttOptions {
  rows?: GanttRow[]
  viewMode?: ViewMode
  /** Force a timeline start. When omitted it is derived from task dates. */
  startDate?: DateInput | null
  /** Force a timeline end. When omitted it is derived from task dates. */
  endDate?: DateInput | null
  rowHeight?: number
  /** Base px-per-day at `Week` view; other view modes scale this. */
  dayWidth?: number
  /** Vertical padding between a bar and its row edges. */
  barPadding?: number
  /** When true, the timeline highlights the current day column. */
  highlightToday?: boolean
  /** Whether tasks are draggable unless overridden per-task. */
  draggable?: boolean
  /**
   * Render only the rows/columns inside the renderer's viewport. Keeps cost
   * bounded by the viewport for very large datasets. Active once a renderer
   * calls `setViewport`; until then the full chart is built. Default `true`.
   */
  virtualize?: boolean
  /** Extra rows rendered above/below the viewport when virtualizing. Default `4`. */
  overscanRows?: number
  /** Extra day columns rendered left/right of the viewport. Default `6`. */
  overscanCols?: number
  /** Optional injected date adapter (defaults to the zero-dep built-in). */
  dateAdapter?: import('./time/date-adapter').DateAdapter
}

/** Fully-resolved options after defaults are applied. */
export type ResolvedGanttOptions = Required<Omit<GanttOptions, 'startDate' | 'endDate' | 'dateAdapter'>> & {
  startDate: DateInput | null
  endDate: DateInput | null
  dateAdapter: import('./time/date-adapter').DateAdapter
}
