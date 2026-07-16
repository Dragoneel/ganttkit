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
  /**
   * Whether the user can resize this column by dragging its header edge.
   * Defaults to the plugin-wide `resizable` option (itself `true`).
   */
  resizable?: boolean
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
  /** Left indentation (px) for the tree column of a (tree) row. */
  getRowIndent: (row: GanttRow) => number
  /**
   * Key of the column that hosts the tree chevron and indentation. Renderers
   * place the toggle on this column instead of assuming the first one. Falls
   * back to the first column when unset or pointing at an unknown key.
   */
  getTreeColumnKey: () => string | undefined
  /** Whether the user may resize the given column by dragging its edge. */
  isColumnResizable: (key: string) => boolean
  /** Minimum width (px) a column may be resized to. */
  getMinColumnWidth: () => number
  /**
   * Commit a new width for a column (clamped to the minimum). Updates the model,
   * persists it if a store is configured, and repaints. Renderers call this once
   * at the end of a resize drag.
   */
  setColumnWidth: (key: string, width: number) => void
}

/**
 * Pluggable persistence for user-resized column widths. Pass a
 * {@link ColumnsOptions.persistWidths} store (or a string key to use
 * `localStorage`) to remember widths across reloads.
 */
export interface ColumnWidthStore {
  /** Return the saved `{ [columnKey]: width }` map, or nullish if none. */
  load: () => Record<string, number> | null | undefined
  /** Persist the current `{ [columnKey]: width }` map. */
  save: (widths: Record<string, number>) => void
}

export interface ColumnsOptions {
  columns?: GanttColumn[]
  /** Total sidebar width in px (columns are normalised to fit). Default `200`. */
  sidebarWidth?: number
  /** Px of indentation per tree level for the tree column. Default `16`. */
  indentPerLevel?: number
  /**
   * Key of the column that shows the tree chevron and indentation. Defaults to
   * the first column. Ignored (falls back to the first column) if no column
   * has this key.
   */
  treeColumn?: string
  /**
   * Whether columns may be resized by dragging their header edge. Acts as the
   * default for each column's own `resizable` flag. Default `true`.
   */
  resizable?: boolean
  /** Smallest width (px) a column may be dragged to. Default `48`. */
  minColumnWidth?: number
  /**
   * Persist user-resized widths across reloads. Pass a string to use
   * `localStorage` under that key, or a custom {@link ColumnWidthStore}.
   */
  persistWidths?: string | ColumnWidthStore
}

/** Installed-plugin handle returned by {@link createColumns}. */
export interface GanttColumns {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  /** Replace the columns and repaint. */
  setColumns: (columns: GanttColumn[]) => void
  /** Set the total sidebar width and repaint. */
  setSidebarWidth: (width: number) => void
  /** Set the column that hosts the tree chevron/indentation and repaint. */
  setTreeColumn: (key: string | undefined) => void
  /** Set (and persist) a single column's width, then repaint. */
  setColumnWidth: (key: string, width: number) => void
  /** Clear all user width overrides (and persisted state), then repaint. */
  resetColumnWidths: () => void
  /** Current user width overrides, as a `{ [columnKey]: width }` map. */
  getColumnWidths: () => Record<string, number>
  /** Current resolved columns. */
  getColumns: () => ResolvedColumn[]
}

/** A {@link ColumnWidthStore} backed by `localStorage` under `key`. */
export function localStorageWidthStore(key: string): ColumnWidthStore {
  const available = () => typeof localStorage !== 'undefined'
  return {
    load() {
      if (!available())
        return null
      try {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as Record<string, number>) : null
      }
      catch {
        return null
      }
    },
    save(widths) {
      if (!available())
        return
      try {
        localStorage.setItem(key, JSON.stringify(widths))
      }
      catch {
        // Ignore quota / privacy-mode / serialization errors  persistence is best-effort.
      }
    },
  }
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
  let treeColumn = options.treeColumn
  const resizableDefault = options.resizable ?? true
  const minColumnWidth = Math.max(1, options.minColumnWidth ?? 48)
  const store: ColumnWidthStore | null = options.persistWidths == null
    ? null
    : typeof options.persistWidths === 'string'
      ? localStorageWidthStore(options.persistWidths)
      : options.persistWidths
  // User overrides (from resize drags / persistence) layered over the base layout.
  let widthOverrides: Record<string, number> = { ...(store?.load() ?? {}) }
  let refresh: (() => void) | null = null

  /** Base layout with any per-column width overrides applied on top. */
  const resolveColumns = (): ResolvedColumn[] =>
    normalizeColumns(columns, sidebarWidth).map(c =>
      widthOverrides[c.key] != null ? { ...c, width: widthOverrides[c.key]! } : c,
    )
  let resolved = resolveColumns()

  /** The tree column key, resolved to a real column (or the first one). */
  const treeColumnKey = () =>
    (treeColumn != null && resolved.some(c => c.key === treeColumn))
      ? treeColumn
      : resolved[0]?.key

  const isResizable = (key: string): boolean => {
    const column = columns.find(c => c.key === key)
    return column ? (column.resizable ?? resizableDefault) : false
  }

  const setColumnWidth = (key: string, width: number): void => {
    if (!isResizable(key))
      return
    widthOverrides = { ...widthOverrides, [key]: Math.max(minColumnWidth, Math.round(width)) }
    store?.save(widthOverrides)
    recompute()
  }

  const recompute = () => {
    resolved = resolveColumns()
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
    getTreeColumnKey: treeColumnKey,
    isColumnResizable: isResizable,
    getMinColumnWidth: () => minColumnWidth,
    setColumnWidth,
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
    setTreeColumn(key) {
      treeColumn = key
      refresh?.()
    },
    setColumnWidth,
    resetColumnWidths() {
      widthOverrides = {}
      store?.save(widthOverrides)
      recompute()
    },
    getColumnWidths: () => ({ ...widthOverrides }),
    getColumns: () => resolved,
  }

  return controller
}
