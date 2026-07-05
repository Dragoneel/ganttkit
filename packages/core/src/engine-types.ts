import type { DateInput, GanttRow, GanttTask, ResolvedGanttOptions, ViewMode } from './types'
import type { TimeScale } from './time/time-scale'
import type { TaskLayout } from './layout/layout-engine'
import type { Scene } from './scene/scene-types'
import type { GanttHit } from './scene/hit-test'
import type { SceneWindow, Viewport } from './scene/viewport'
import type { Store } from './state/store'
import type { EventBus } from './plugin/event-bus'
import type { CommandRegistry } from './plugin/commands'
import type { ServiceRegistry } from './plugin/service-registry'
import type { UiRegistry } from './plugin/ui-registry'
import type { Hook } from './plugin/hooks'
import type { DragMode } from './interaction/drag'

/** The engine's reactive state. Plugins read/patch this via the store. */
export interface GanttState {
  rows: GanttRow[]
  viewMode: ViewMode
  selectedTaskId: string | null
  loading: boolean
}

/** Payload shared by task pointer events. */
export interface TaskPointerEvent {
  task: GanttTask
  row: GanttRow
  originalEvent?: Event
}

/** Payload for `task:hover`: the task under the pointer plus its screen position. */
export interface TaskHoverEvent {
  task: GanttTask
  row: GanttRow
  /** The resize handle under the pointer, when over a bar's edge. */
  handle: 'left' | 'right' | null
  /** Pointer position in client (screen) coordinates, for placing overlays. */
  clientX: number
  clientY: number
}

/** Payload for drag lifecycle events. */
export interface TaskDragEvent {
  task: GanttTask
  row: GanttRow
  mode: DragMode
  start: Date
  end: Date
  /** `true` once the dates actually differ from the original (on dragend). */
  changed: boolean
}

/**
 * Why the scene was rebuilt:
 * - `data`  rows/view mode/columns changed (timescale + header may differ)
 * - `viewport`  the user scrolled/resized (only the window moved)
 * - `preview`  a transient drag preview
 *
 * Renderers use this to skip unnecessary header rebuilds on scroll.
 */
export type SceneChangeReason = 'data' | 'viewport' | 'preview'

/** Strongly-typed engine event channels. */
export interface GanttEventMap {
  'task:click': TaskPointerEvent
  'task:dblclick': TaskPointerEvent
  /** The pointer moved over a task (fires on every move while over one). */
  'task:hover': TaskHoverEvent
  /** The pointer left the task it was over (or left the chart). */
  'task:hoverend': Record<string, never>
  'task:dragstart': { task: GanttTask, row: GanttRow, mode: DragMode }
  'task:dragmove': TaskDragEvent
  'task:dragend': TaskDragEvent
  'viewmode:change': { viewMode: ViewMode }
  'daterange:change': { start: Date, end: Date }
  'rows:change': { rows: GanttRow[] }
  'scene:change': { scene: Scene, reason: SceneChangeReason }
  'selection:change': { taskId: string | null }
  /**
   * A row's expand/collapse affordance was activated (e.g. the sidebar chevron).
   * Generic by design: a tree plugin listens for it, but the renderer that emits
   * it knows nothing about trees.
   */
  'row:toggle': { rowId: string }
}

/** Context handed to the `scene` hook so taps can extend the scene precisely. */
export interface SceneHookContext {
  scale: TimeScale
  layouts: TaskLayout[]
  options: ResolvedGanttOptions
}

/**
 * Data pipelines plugins tap into. Each runs during the engine's compute pass,
 * letting feature plugins reshape data without subclassing anything.
 */
export interface GanttHooks {
  /** Transform the row set before layout (filtering, sorting, grouping). */
  rows: Hook<GanttRow[]>
  /** Transform/extend the scene before it is published to renderers. */
  scene: Hook<Scene, SceneHookContext>
}

/** Public engine surface exposed to plugins (a subset of `GanttEngine`). */
export interface GanttEngineApi {
  getState: () => Readonly<GanttState>
  getOptions: () => ResolvedGanttOptions
  getTimeScale: () => TimeScale
  getScene: () => Scene
  /**
   * Hit-test a point in scene coordinates → the task (and resize handle) under
   * it, or `null`. Renderers convert pointer coordinates to scene space and call
   * this instead of re-implementing hit geometry.
   */
  hitTest: (x: number, y: number) => GanttHit | null
  /**
   * Task ids whose bars intersect a rectangle in scene coordinates (for
   * rubber-band selection). Renderers map the drag rectangle into scene space.
   */
  hitTestRegion: (x1: number, y1: number, x2: number, y2: number) => string[]
  /** Rows after the `rows` hook  what a renderer should display. */
  getRows: () => GanttRow[]
  setRows: (rows: GanttRow[]) => void
  setViewMode: (mode: ViewMode) => void
  /** Swap the date adapter (e.g. to change locale) and recompute. */
  setDateAdapter: (adapter: import('./time/date-adapter').DateAdapter) => void
  selectTask: (taskId: string | null) => void
  updateTaskDates: (taskId: string, start: DateInput, end: DateInput) => boolean
  /** Report the visible region so the engine can window the scene (or `null` for full). */
  setViewport: (viewport: Viewport | null) => void
  /** The window resolved for the current viewport, or `null` when not virtualizing. */
  getWindow: () => SceneWindow | null
  /** Show a transient drag/resize preview for a task without committing it. */
  setDragPreview: (taskId: string, start: DateInput, end: DateInput) => void
  /** Remove any active drag preview. */
  clearDragPreview: () => void
  /** Publish a capability for renderers/plugins to consume (see ServiceRegistry). */
  provide: <T>(key: string, service: T) => () => void
  /** Look up a capability published by a plugin, or `undefined`. */
  consume: <T>(key: string) => T | undefined
  /** Force a recompute (timescale → layout → scene) and notify renderers. */
  refresh: () => void
}

/**
 * Everything a plugin receives at install time. Feature plugins manipulate
 * data/commands/hooks/services; UI plugins read state + scene and subscribe.
 */
export interface GanttContext {
  readonly store: Store<GanttState>
  readonly events: EventBus<GanttEventMap>
  readonly commands: CommandRegistry
  readonly services: ServiceRegistry
  /** UI contribution registry (toolbar/overlay slots). */
  readonly ui: UiRegistry
  readonly hooks: GanttHooks
  readonly engine: GanttEngineApi
}

/**
 * A plugin is a named installer. `install` may return a disposer that the
 * engine calls on `destroy()` or when the plugin is removed.
 */
export interface GanttPlugin {
  name: string
  install: (context: GanttContext) => void | (() => void)
}
