import type { ResolvedGanttOptions } from '../types'
import type { TimeScale } from '../time/time-scale'
import type { TaskLayout } from '../layout/layout-engine'
import type { DependencyLink } from '../layout/dependencies'
import { contentHeight } from '../layout/layout-engine'
import type { Scene, SceneLayer, ScenePrimitive } from './scene-types'
import { SCENE_MARKERS } from './scene-types'
import type { SceneWindow } from './viewport'

/** Ten-point star centred on the origin, matching the original milestone glyph. */
const STAR_POINTS = '0,-12 3,-5 12,-5 5,0 8,7 0,3 -8,7 -5,0 -12,-5 -3,-5'

/** Below this bar width, labels switch to the compact class. */
const LABEL_SMALL_WIDTH = 40

export interface BuildSceneParams {
  /** Total number of rows (drives full canvas height + scrollbars). */
  rowCount: number
  scale: TimeScale
  /** Task layouts to draw. When windowing, pass only the visible ones. */
  layouts: TaskLayout[]
  /** Dependency links to draw. When windowing, pass only the visible ones. */
  links: DependencyLink[]
  options: ResolvedGanttOptions
  /**
   * Visible row/day ranges. When omitted, the whole chart is drawn.
   * Backgrounds and grid lines are limited to this window; `layouts`/`links`
   * are assumed already filtered by the caller.
   */
  window?: SceneWindow
}

/**
 * Build the scene for one render pass.
 *
 * The canvas is always full-size (`width`/`height` cover the whole dataset, so
 * scrollbars are correct), but only primitives inside `window` are emitted. With
 * no `window`, the full chart is drawn. Layers paint back-to-front.
 */
export function buildScene(params: BuildSceneParams): Scene {
  const { rowCount, scale, layouts, links, options } = params
  const height = contentHeight(rowCount, options.rowHeight)
  const win: SceneWindow = params.window ?? {
    rowStart: 0,
    rowEnd: rowCount,
    dayStart: 0,
    dayEnd: scale.totalDays,
  }

  return {
    width: scale.width,
    height,
    layers: [
      weekendLayer(scale, height, options.highlightToday, win),
      gridLayer(scale, options.rowHeight, height, win),
      dependencyLayer(links),
      barLayer(layouts),
      handleLayer(layouts, options),
      milestoneLayer(layouts),
      labelLayer(layouts),
    ],
  }
}

function weekendLayer(scale: TimeScale, height: number, highlightToday: boolean, win: SceneWindow): SceneLayer {
  const primitives: ScenePrimitive[] = []
  for (let i = win.dayStart; i < win.dayEnd; i++) {
    const day = scale.days[i]
    if (!day)
      continue
    if (day.isWeekend) {
      primitives.push({
        type: 'rect',
        key: `weekend-${day.key}`,
        className: 'gantt-weekend',
        x: i * scale.dayWidth,
        y: 0,
        width: scale.dayWidth,
        height,
      })
    }
    if (highlightToday && day.isToday) {
      primitives.push({
        type: 'rect',
        key: `today-${day.key}`,
        className: 'gantt-today',
        x: i * scale.dayWidth,
        y: 0,
        width: scale.dayWidth,
        height,
      })
    }
  }
  return { name: 'backgrounds', primitives }
}

function gridLayer(scale: TimeScale, rowHeight: number, height: number, win: SceneWindow): SceneLayer {
  const primitives: ScenePrimitive[] = []
  for (let i = win.dayStart; i < win.dayEnd; i++) {
    const day = scale.days[i]
    if (!day)
      continue
    primitives.push({
      type: 'line',
      key: `vline-${day.key}`,
      className: day.isWeekend ? 'gantt-gridline gantt-gridline--weekend' : 'gantt-gridline',
      x1: i * scale.dayWidth,
      y1: 0,
      x2: i * scale.dayWidth,
      y2: height,
    })
  }
  for (let i = win.rowStart; i < win.rowEnd; i++) {
    primitives.push({
      type: 'line',
      key: `hline-${i}`,
      className: 'gantt-gridline',
      x1: 0,
      y1: i * rowHeight,
      x2: scale.width,
      y2: i * rowHeight,
    })
  }
  return { name: 'grid', primitives }
}

function dependencyLayer(links: DependencyLink[]): SceneLayer {
  return {
    name: 'dependencies',
    primitives: links.map(link => ({
      type: 'path' as const,
      key: `dep-${link.sourceTaskId}-${link.targetTaskId}`,
      className: 'gantt-dependency',
      d: link.path,
      markerEnd: SCENE_MARKERS.arrow,
    })),
  }
}

function barLayer(layouts: TaskLayout[]): SceneLayer {
  return {
    name: 'bars',
    primitives: layouts
      .filter(l => !l.isMilestone)
      .map(l => ({
        type: 'rect' as const,
        key: `bar-${l.task.id}`,
        className: ['gantt-bar', l.task.className].filter(Boolean).join(' '),
        x: l.x,
        y: l.y,
        width: l.width,
        height: l.height,
        rx: 3,
        taskId: l.task.id,
        title: l.task.tooltip ?? l.task.name,
        data: { 'task-id': l.task.id, 'row-id': l.rowId },
      })),
  }
}

function handleLayer(layouts: TaskLayout[], options: ResolvedGanttOptions): SceneLayer {
  const primitives: ScenePrimitive[] = []
  for (const l of layouts) {
    if (l.isMilestone)
      continue
    const draggable = l.task.draggable ?? options.draggable
    if (!draggable)
      continue
    const y = l.y + 2
    const h = l.height - 4
    primitives.push(
      {
        type: 'rect',
        key: `handle-l-${l.task.id}`,
        className: 'gantt-handle gantt-handle--left',
        x: l.x - 4,
        y,
        width: 8,
        height: h,
        taskId: l.task.id,
        data: { 'task-id': l.task.id, 'handle': 'left' },
      },
      {
        type: 'rect',
        key: `handle-r-${l.task.id}`,
        className: 'gantt-handle gantt-handle--right',
        x: l.x + l.width - 4,
        y,
        width: 8,
        height: h,
        taskId: l.task.id,
        data: { 'task-id': l.task.id, 'handle': 'right' },
      },
    )
  }
  return { name: 'handles', primitives }
}

function milestoneLayer(layouts: TaskLayout[]): SceneLayer {
  return {
    name: 'milestones',
    primitives: layouts
      .filter(l => l.isMilestone)
      .map(l => ({
        type: 'polygon' as const,
        key: `milestone-${l.task.id}`,
        className: ['gantt-milestone', l.task.className].filter(Boolean).join(' '),
        points: STAR_POINTS,
        transform: `translate(${l.x + l.width}, ${l.cy})`,
        taskId: l.task.id,
        title: l.task.tooltip ?? l.task.name,
        data: { 'task-id': l.task.id, 'row-id': l.rowId },
      })),
  }
}

function labelLayer(layouts: TaskLayout[]): SceneLayer {
  return {
    name: 'labels',
    primitives: layouts
      .filter(l => !l.isMilestone)
      .map(l => ({
        type: 'text' as const,
        key: `label-${l.task.id}`,
        className: l.width < LABEL_SMALL_WIDTH ? 'gantt-label gantt-label--small' : 'gantt-label',
        x: l.x + l.width / 2,
        y: l.cy,
        text: l.task.name,
        anchor: 'middle' as const,
        baseline: 'middle' as const,
      })),
  }
}
