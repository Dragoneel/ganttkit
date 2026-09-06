import type { CSSProperties, ReactElement, Ref } from 'react'
import { useImperativeHandle, useRef } from 'react'
import type {
  GanttEngine,
  GanttRow,
  TaskDragEvent,
  TaskHoverEvent,
  TaskPointerEvent,
  ViewMode,
} from '@ganttkit/core'
import type { GanttChartOptions } from './engine'
import { useGantt } from './use-gantt'

/** Imperative handle exposed through `ref`. */
export interface GanttChartHandle {
  /** The live engine, or `null` before mount / after unmount. */
  engine: GanttEngine | null
}

export interface GanttChartProps extends GanttChartOptions {
  ref?: Ref<GanttChartHandle>
  className?: string
  style?: CSSProperties
  /** The engine is live - install more plugins or keep a reference. */
  onReady?: (engine: GanttEngine) => void
  onTaskClick?: (payload: TaskPointerEvent) => void
  onTaskDblClick?: (payload: TaskPointerEvent) => void
  onTaskHover?: (payload: TaskHoverEvent) => void
  onTaskHoverEnd?: () => void
  onTaskDragStart?: (payload: { task: TaskPointerEvent['task'], row: GanttRow, mode: TaskDragEvent['mode'] }) => void
  onTaskDragMove?: (payload: TaskDragEvent) => void
  onTaskDragEnd?: (payload: TaskDragEvent) => void
  onViewModeChange?: (payload: { viewMode: ViewMode }) => void
  onDateRangeChange?: (payload: { start: Date, end: Date }) => void
  onRowsChange?: (payload: { rows: GanttRow[] }) => void
  onSelectionChange?: (payload: { taskId: string | null }) => void
  onRowToggle?: (payload: { rowId: string }) => void
}

/**
 * Renders a GanttKit chart into its own root element.
 *
 * ```tsx
 * <GanttChart rows={rows} viewMode="Week" plugins={plugins} style={{ height: '70vh' }} />
 * ```
 *
 * The component owns one engine. `rows`, `viewMode`, `theme` and `dateAdapter`
 * are applied to the live engine; any other option is only read when the engine
 * is built, so changing it rebuilds the chart. Callbacks are read through a ref,
 * so they never need memoizing. The root element needs a height to be visible.
 */
export function GanttChart(props: GanttChartProps): ReactElement {
  const {
    ref,
    className,
    style,
    onReady,
    onTaskClick,
    onTaskDblClick,
    onTaskHover,
    onTaskHoverEnd,
    onTaskDragStart,
    onTaskDragMove,
    onTaskDragEnd,
    onViewModeChange,
    onDateRangeChange,
    onRowsChange,
    onSelectionChange,
    onRowToggle,
    ...options
  } = props

  const host = useRef<HTMLDivElement>(null)
  // Handlers are read at call time, so a fresh arrow per render is free.
  const latest = useRef(props)
  latest.current = props

  const engine = useGantt(host, options, {
    onCreated(created) {
      // `scene:change` is deliberately not forwarded: it fires on every scroll
      // frame. Reach for `engine.events` when you need it.
      created.events.on('task:click', p => latest.current.onTaskClick?.(p))
      created.events.on('task:dblclick', p => latest.current.onTaskDblClick?.(p))
      created.events.on('task:hover', p => latest.current.onTaskHover?.(p))
      created.events.on('task:hoverend', () => latest.current.onTaskHoverEnd?.())
      created.events.on('task:dragstart', p => latest.current.onTaskDragStart?.(p))
      created.events.on('task:dragmove', p => latest.current.onTaskDragMove?.(p))
      created.events.on('task:dragend', p => latest.current.onTaskDragEnd?.(p))
      created.events.on('viewmode:change', p => latest.current.onViewModeChange?.(p))
      created.events.on('daterange:change', p => latest.current.onDateRangeChange?.(p))
      created.events.on('rows:change', p => latest.current.onRowsChange?.(p))
      created.events.on('selection:change', p => latest.current.onSelectionChange?.(p))
      created.events.on('row:toggle', p => latest.current.onRowToggle?.(p))
      latest.current.onReady?.(created)
    },
  })

  useImperativeHandle(ref, () => ({ engine }), [engine])

  return <div ref={host} className={className} style={style} />
}
