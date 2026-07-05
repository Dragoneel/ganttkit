/**
 * @ganttkit/core  headless, framework-agnostic Gantt engine.
 *
 * Import the engine and compose it with plugins:
 *
 * ```ts
 * import { GanttEngine } from '@ganttkit/core'
 * const gantt = new GanttEngine({ rows }).use(myRenderer).use(myFeature)
 * ```
 */

// Engine
export { GanttEngine } from './gantt'

// Domain types
export type {
  DateInput,
  GanttOptions,
  GanttRow,
  GanttTask,
  ResolvedGanttOptions,
  TaskKind,
  ViewMode,
} from './types'

// Engine contracts
export type {
  GanttContext,
  GanttEngineApi,
  GanttEventMap,
  GanttHooks,
  GanttPlugin,
  GanttState,
  SceneChangeReason,
  SceneHookContext,
  TaskDragEvent,
  TaskHoverEvent,
  TaskPointerEvent,
} from './engine-types'

// Time
export type { DateAdapter } from './time/date-adapter'
export { defaultDateAdapter } from './time/date-adapter'
export { createIntlAdapter } from './time/intl-adapter'
export type { IntlAdapterOptions } from './time/intl-adapter'
export {
  TimeScale,
  VIEW_MODE_SCALE,
  deriveDateRange,
  effectiveDayWidth,
} from './time/time-scale'
export type { DayCell, MonthCell, WeekCell } from './time/time-scale'

// Layout
export { computeTaskLayouts, contentHeight } from './layout/layout-engine'
export type { TaskLayout } from './layout/layout-engine'
export { computeDependencyLinks } from './layout/dependencies'
export type { DependencyLink } from './layout/dependencies'

// Scene
export { buildScene } from './scene/scene-builder'
export type { BuildSceneParams } from './scene/scene-builder'
export { hitTestRegion, hitTestScene } from './scene/hit-test'
export type { GanttHit } from './scene/hit-test'
export { SCENE_MARKERS } from './scene/scene-types'
export { resolveWindow, sameViewport } from './scene/viewport'
export type { SceneWindow, Viewport } from './scene/viewport'
export type {
  Scene,
  SceneLayer,
  SceneLine,
  SceneNodeBase,
  ScenePath,
  ScenePolygon,
  ScenePrimitive,
  SceneRect,
  SceneText,
  VectorPrimitive,
} from './scene/scene-types'

// Interaction
export {
  beginDrag,
  dragVisualDelta,
  resolveDraggedDates,
  updateDrag,
} from './interaction/drag'
export type { DragMode, DragState } from './interaction/drag'
export { resolvePan } from './interaction/pan'
export type { PanOrigin } from './interaction/pan'
export { VIEW_MODE_ORDER, stepViewMode, wheelToViewMode } from './interaction/zoom'

// Reactive primitives (useful for advanced plugins)
export { Store } from './state/store'
export type { StoreListener, StoreUpdate } from './state/store'
export { EventBus } from './plugin/event-bus'
export { CommandRegistry } from './plugin/commands'
export { ServiceRegistry } from './plugin/service-registry'
export { UI_SLOTS, UiRegistry } from './plugin/ui-registry'
export type { UiContribution, UiMount, UiMountContext } from './plugin/ui-registry'
export { GANTT_VIEWPORT_SERVICE } from './plugin/viewport-port'
export type { GanttViewportPort } from './plugin/viewport-port'
export { Hook } from './plugin/hooks'
export type { HookFn } from './plugin/hooks'
