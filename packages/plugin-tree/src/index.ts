/**
 * @ganttkit/plugin-tree  hierarchical rows with expand/collapse.
 *
 * A rows-hook plugin. Rows relate via `parentId`; the plugin hides descendants
 * of collapsed rows and annotates each row with `level`, `hasChildren`, and
 * `expanded` (core fields the renderers' sidebar reads to draw a chevron).
 * Toggling is driven by the generic `row:toggle` engine event (emitted by the
 * renderers) and by commands  so this plugin never touches the DOM.
 *
 * ```ts
 * import { createTree } from '@ganttkit/plugin-tree'
 * const tree = createTree({ collapsed: ['build'] })
 * engine.use(tree.plugin)
 * // rows: [{ id: 'build', name: 'Build' }, { id: 'api', parentId: 'build', ... }]
 * tree.collapseAll()
 * ```
 */
import type { GanttPlugin, GanttRow } from '@ganttkit/core'

export interface TreeOptions {
  /** Row ids collapsed initially. */
  collapsed?: string[]
}

export interface GanttTree {
  /** Pass to `engine.use(...)`. */
  readonly plugin: GanttPlugin
  toggle: (rowId: string) => void
  expand: (rowId: string) => void
  collapse: (rowId: string) => void
  expandAll: () => void
  collapseAll: () => void
  isCollapsed: (rowId: string) => boolean
}

export function createTree(options: TreeOptions = {}): GanttTree {
  const collapsed = new Set<string>(options.collapsed ?? [])
  let parents = new Set<string>() // ids that have children (from the latest pass)
  let refresh: (() => void) | null = null

  function transform(rows: GanttRow[]): GanttRow[] {
    const byId = new Map(rows.map(r => [r.id, r]))
    const childCount = new Map<string, number>()
    for (const r of rows) {
      if (r.parentId)
        childCount.set(r.parentId, (childCount.get(r.parentId) ?? 0) + 1)
    }
    parents = new Set(childCount.keys())

    const levelOf = (row: GanttRow): number => {
      let depth = 0
      let parent = row.parentId
      while (parent) {
        depth++
        parent = byId.get(parent)?.parentId
      }
      return depth
    }
    const hiddenByAncestor = (row: GanttRow): boolean => {
      let parent = row.parentId
      while (parent) {
        if (collapsed.has(parent))
          return true
        parent = byId.get(parent)?.parentId
      }
      return false
    }

    const out: GanttRow[] = []
    for (const row of rows) {
      if (hiddenByAncestor(row))
        continue
      const hasChildren = childCount.has(row.id)
      out.push({
        ...row,
        level: row.level ?? levelOf(row),
        hasChildren,
        expanded: hasChildren ? !collapsed.has(row.id) : row.expanded,
      })
    }
    return out
  }

  const plugin: GanttPlugin = {
    name: 'tree',
    install(ctx) {
      refresh = () => ctx.engine.refresh()
      const offHook = ctx.hooks.rows.tap(transform)
      const offEvent = ctx.events.on('row:toggle', ({ rowId }) => controller.toggle(rowId))
      const offCmds = [
        ctx.commands.register('tree.toggle', (id: string) => controller.toggle(id)),
        ctx.commands.register('tree.expand', (id: string) => controller.expand(id)),
        ctx.commands.register('tree.collapse', (id: string) => controller.collapse(id)),
        ctx.commands.register('tree.expandAll', () => controller.expandAll()),
        ctx.commands.register('tree.collapseAll', () => controller.collapseAll()),
      ]
      refresh()
      return () => {
        offHook()
        offEvent()
        for (const off of offCmds)
          off()
        refresh = null
      }
    },
  }

  const controller: GanttTree = {
    plugin,
    toggle(rowId) {
      if (collapsed.has(rowId))
        collapsed.delete(rowId)
      else
        collapsed.add(rowId)
      refresh?.()
    },
    expand(rowId) {
      if (collapsed.delete(rowId))
        refresh?.()
    },
    collapse(rowId) {
      if (!collapsed.has(rowId)) {
        collapsed.add(rowId)
        refresh?.()
      }
    },
    expandAll() {
      if (collapsed.size > 0) {
        collapsed.clear()
        refresh?.()
      }
    },
    collapseAll() {
      collapsed.clear()
      for (const id of parents)
        collapsed.add(id)
      refresh?.()
    },
    isCollapsed(rowId) {
      return collapsed.has(rowId)
    },
  }

  return controller
}
