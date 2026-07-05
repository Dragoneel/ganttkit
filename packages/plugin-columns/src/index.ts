/**
 * @ganttkit/plugin-columns  the sidebar/columns feature, as a plugin.
 *
 * The core engine knows nothing about sidebars. This plugin owns the column
 * model and publishes a {@link SidebarModel} under the {@link SIDEBAR_SERVICE}
 * key via the engine's service registry. Renderers consume that service to draw
 * the sidebar; with the plugin absent, they render a chart-only timeline.
 *
 * ```ts
 * import { createColumns } from '@ganttkit/plugin-columns'
 *
 * const columns = createColumns({
 *   sidebarWidth: 220,
 *   columns: [
 *     { key: 'name', label: 'Task' },
 *     { key: 'owner', label: 'Owner', width: 80 },
 *   ],
 * })
 * engine.use(columns.plugin)
 * columns.setColumns([{ key: 'name', label: 'Name' }])
 * ```
 */
import type { GanttPlugin, GanttRow } from '@ganttkit/core'

/** Well-known service key renderers look up to find a sidebar provider. */
export const SIDEBAR_SERVICE = 'gantt:sidebar'

/** A sidebar column descriptor. */
export interface GanttColumn {
  key: string
  label: string
  /** Fixed width in px. When omitted, remaining sidebar width is distributed. */
  width?: number
  /** Custom cell text. Receives the row; defaults to `String(row[key])`. */
  formatter?: (row: GanttRow) => string
}

/** A column with its width resolved to a concrete number. */
export interface ResolvedColumn extends GanttColumn {
  width: number
}

/**
 * The contract a renderer consumes to draw the sidebar. Published under
 * {@link SIDEBAR_SERVICE}. Renderers depend only on this shape, never on the
 * plugin package itself.
 */
export interface SidebarModel {
  /** Columns with concrete widths, in display order. */
  getColumns: () => ResolvedColumn[]
  /** Total sidebar width in px. */
  getSidebarWidth: () => number
  /** Display text for a row/column cell. */
  getCellValue: (row: GanttRow, columnKey: string) => string
  /** Left indentation (px) for the first column of a (tree) row. */
  getRowIndent: (row: GanttRow) => number
}

export interface ColumnsOptions {
  columns?: GanttColumn[]
  /** Total sidebar width in px (columns are normalised to fit). Default `200`. */
  sidebarWidth?: number
  /** Px of indentation per tree level for the first column. Default `16`. */
  indentPerLevel?: number
}

/** Installed-plugin handle returned by {@link createColumns}. */
export interface GanttColumns {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  /** Replace the columns and repaint. */
  setColumns: (columns: GanttColumn[]) => void
  /** Set the total sidebar width and repaint. */
  setSidebarWidth: (width: number) => void
  /** Current resolved columns. */
  getColumns: () => ResolvedColumn[]
}

/**
 * Resolve columns to concrete widths.
 *
 * Columns with an explicit width keep it; remaining width is shared among the
 * rest, floored at `sidebarWidth / count` so columns never collapse. Falls back
 * to a single `name` column. (Ported from the original EpGantt normalisation.)
 */
export function normalizeColumns(columns: GanttColumn[], sidebarWidth: number): ResolvedColumn[] {
  const cols = columns.length > 0
    ? columns
    : [{ key: 'name', label: 'Name', width: sidebarWidth }]

  const specified = cols.reduce((sum, c) => sum + (c.width ?? 0), 0)
  const unspecified = cols.filter(c => !c.width)
  const remaining = Math.max(sidebarWidth - specified, 0)
  const auto = unspecified.length > 0
    ? Math.max(remaining / unspecified.length, sidebarWidth / cols.length)
    : undefined

  return cols.map(c => ({
    ...c,
    width: c.width || auto || sidebarWidth / cols.length,
  }))
}

/** Display value for a row under a column (formatter, own key, or first task). */
export function columnValue(row: GanttRow, column: GanttColumn): string {
  if (typeof column.formatter === 'function')
    return column.formatter(row)
  const value = (column.key in row)
    ? (row as unknown as Record<string, unknown>)[column.key]
    : (row.tasks[0] as Record<string, unknown> | undefined)?.[column.key]
  return value == null ? '' : String(value)
}

/** Create a columns controller and its plugin. */
export function createColumns(options: ColumnsOptions = {}): GanttColumns {
  let columns = options.columns ?? []
  let sidebarWidth = options.sidebarWidth ?? 200
  const indentPerLevel = options.indentPerLevel ?? 16
  let resolved = normalizeColumns(columns, sidebarWidth)
  let refresh: (() => void) | null = null

  const recompute = () => {
    resolved = normalizeColumns(columns, sidebarWidth)
    refresh?.()
  }

  const model: SidebarModel = {
    getColumns: () => resolved,
    getSidebarWidth: () => resolved.reduce((sum, c) => sum + c.width, 0) || sidebarWidth,
    getCellValue: (row, key) => {
      const column = resolved.find(c => c.key === key)
      return column ? columnValue(row, column) : ''
    },
    getRowIndent: row => (row.level ?? 0) * indentPerLevel,
  }

  const plugin: GanttPlugin = {
    name: 'columns',
    install(ctx) {
      refresh = () => ctx.engine.refresh()
      const offService = ctx.services.provide<SidebarModel>(SIDEBAR_SERVICE, model)
      const offSet = ctx.commands.register('columns.set', (cols: GanttColumn[]) => controller.setColumns(cols))
      // Trigger an initial paint so a renderer installed first picks up the sidebar.
      refresh()
      return () => {
        offService()
        offSet()
        refresh = null
      }
    },
  }

  const controller: GanttColumns = {
    plugin,
    setColumns(cols) {
      columns = cols
      recompute()
    },
    setSidebarWidth(width) {
      sidebarWidth = width
      recompute()
    },
    getColumns: () => resolved,
  }

  return controller
}
