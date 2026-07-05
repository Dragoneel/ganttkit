/**
 * @ganttkit/plugin-filter  a feature plugin that filters rows and tasks.
 *
 * It demonstrates the GanttKit feature-plugin contract: tap the `rows` data
 * hook to reshape the dataset before layout, expose imperative `commands`, and
 * hand back a small controller for ergonomic use.
 *
 * ```ts
 * import { createFilter, filters } from '@ganttkit/plugin-filter'
 *
 * const filter = createFilter()
 * engine.use(filter.plugin)
 * filter.setTaskFilter(filters.taskNameIncludes('api'))
 * filter.clear()
 * ```
 */
import type { GanttPlugin, GanttRow, GanttTask } from '@ganttkit/core'

/** Keep a row when this returns `true`. */
export type RowPredicate = (row: GanttRow) => boolean
/** Keep a task when this returns `true`. */
export type TaskPredicate = (task: GanttTask, row: GanttRow) => boolean

export interface FilterOptions {
  /** Initial row-level predicate. */
  row?: RowPredicate
  /** Initial task-level predicate. */
  task?: TaskPredicate
  /** Drop rows left with no tasks after task filtering. Default `true`. */
  dropEmptyRows?: boolean
}

/** Installed-plugin handle returned by {@link createFilter}. */
export interface GanttFilter {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  /** Replace the row predicate (`null` clears it) and recompute. */
  setRowFilter: (predicate: RowPredicate | null) => void
  /** Replace the task predicate (`null` clears it) and recompute. */
  setTaskFilter: (predicate: TaskPredicate | null) => void
  /** Clear both predicates and recompute. */
  clear: () => void
}

/**
 * Create a filter controller and its plugin.
 *
 * Task filtering runs first (per-row), then optional empty-row pruning, then the
 * row filter  so `dropEmptyRows` hides rows whose tasks were all filtered out.
 */
export function createFilter(options: FilterOptions = {}): GanttFilter {
  let rowPredicate: RowPredicate | null = options.row ?? null
  let taskPredicate: TaskPredicate | null = options.task ?? null
  const dropEmptyRows = options.dropEmptyRows ?? true
  let refresh: (() => void) | null = null

  const apply = (rows: GanttRow[]): GanttRow[] => {
    let out = rows
    if (taskPredicate) {
      const predicate = taskPredicate
      out = out.map(row => ({ ...row, tasks: row.tasks.filter(task => predicate(task, row)) }))
      if (dropEmptyRows)
        out = out.filter(row => row.tasks.length > 0)
    }
    if (rowPredicate)
      out = out.filter(rowPredicate)
    return out
  }

  const plugin: GanttPlugin = {
    name: 'filter',
    install(ctx) {
      refresh = () => ctx.engine.refresh()
      const offHook = ctx.hooks.rows.tap(apply)
      const offClear = ctx.commands.register('filter.clear', () => controller.clear())
      const offRow = ctx.commands.register('filter.setRowFilter', (p: RowPredicate | null) => controller.setRowFilter(p))
      const offTask = ctx.commands.register('filter.setTaskFilter', (p: TaskPredicate | null) => controller.setTaskFilter(p))
      return () => {
        offHook()
        offClear()
        offRow()
        offTask()
        refresh = null
      }
    },
  }

  const controller: GanttFilter = {
    plugin,
    setRowFilter(predicate) {
      rowPredicate = predicate
      refresh?.()
    },
    setTaskFilter(predicate) {
      taskPredicate = predicate
      refresh?.()
    },
    clear() {
      rowPredicate = null
      taskPredicate = null
      refresh?.()
    },
  }

  return controller
}

/** Ready-made predicate builders for common cases. */
export const filters = {
  taskNameIncludes(query: string): TaskPredicate {
    const q = query.toLowerCase()
    return task => task.name.toLowerCase().includes(q)
  },
  rowNameIncludes(query: string): RowPredicate {
    const q = query.toLowerCase()
    return row => row.name.toLowerCase().includes(q)
  },
  /** Keep tasks whose `[start, end]` overlaps `[from, to]`. */
  taskOverlaps(from: Date, to: Date): TaskPredicate {
    return (task) => {
      const start = new Date(task.start).getTime()
      const end = new Date(task.end).getTime()
      return end >= from.getTime() && start <= to.getTime()
    }
  },
} as const
