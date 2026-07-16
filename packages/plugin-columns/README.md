# @ganttkit/plugin-columns

The **sidebar columns** feature for GanttKit  deliberately a plugin, not part
of the core engine.

The core knows nothing about sidebars. This plugin owns the column model
(definitions, widths, formatters, tree indentation) and publishes a
`SidebarModel` under the well-known service key `'gantt:sidebar'`. Renderers
(`@ganttkit/svg`, `@ganttkit/html`, `@ganttkit/vue`, …) draw a sidebar **only** when this
service is present; otherwise they render a timeline-only chart.

```ts
import { GanttEngine } from '@ganttkit/core'
import { createColumns } from '@ganttkit/plugin-columns'

const engine = new GanttEngine({ rows })
const columns = createColumns({
  sidebarWidth: 220,
  columns: [
    { key: 'name', label: 'Task' },
    { key: 'owner', label: 'Owner', width: 80, formatter: r => String(r.meta?.owner ?? '') },
  ],
})
engine.use(columns.plugin)

columns.setColumns([{ key: 'name', label: 'Name' }]) // reactive
```

## API

- `createColumns(options?) → GanttColumns`
  - `options.columns`  column descriptors (`{ key, label, width?, formatter?, resizable? }`)
  - `options.sidebarWidth`  total width in px (default `200`)
  - `options.indentPerLevel`  px per `row.level` for the tree column (default `16`)
  - `options.treeColumn`  key of the column that shows the tree chevron/indentation (default: first column)
  - `options.resizable`  allow dragging a column's header edge to resize it (default `true`; per-column `resizable` overrides it)
  - `options.minColumnWidth`  smallest width a column can be dragged to (default `48`)
  - `options.persistWidths`  remember resized widths: a `localStorage` key string, or a custom `ColumnWidthStore` (`{ load, save }`)
- `GanttColumns`: `{ plugin, setColumns, setSidebarWidth, setTreeColumn, setColumnWidth, resetColumnWidths, getColumnWidths, getColumns }`
- Helpers: `normalizeColumns`, `columnValue`, `localStorageWidthStore`
- Contract: `SidebarModel`, `SIDEBAR_SERVICE`, `ColumnWidthStore`

### Resizable columns

```ts
const columns = createColumns({
  columns: [
    { key: 'name', label: 'Task' },
    { key: 'owner', label: 'Owner', resizable: false }, // opt a column out
  ],
  minColumnWidth: 60,
  persistWidths: 'my-gantt-columns', // localStorage key; or pass a { load, save } store
})
```

Renderers add a drag handle to each resizable column's header edge. Dragging previews live; on release the width is committed and persisted. Widths saved under `persistWidths` are restored on the next load.

## The service pattern

```ts
install(ctx) {
  const off = ctx.services.provide('gantt:sidebar', sidebarModel) // publish capability
  return off                                                      // remove on uninstall
}
```

A renderer consumes it with `engine.consume('gantt:sidebar')`  no compile-time
dependency on this package, just the shared key and shape.

## License

MIT
