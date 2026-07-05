# @ganttkit/plugin-filter

A **feature plugin** for GanttKit that filters rows and tasks. It also serves as
the reference example of the feature-plugin contract: it taps the `rows` data
hook, registers `commands`, and returns a small controller.

```ts
import { GanttEngine } from '@ganttkit/core'
import { createFilter, filters } from '@ganttkit/plugin-filter'

const engine = new GanttEngine({ rows })
const filter = createFilter()
engine.use(filter.plugin)

// Show only tasks whose name contains "api":
filter.setTaskFilter(filters.taskNameIncludes('api'))

// Show only rows named like "design":
filter.setRowFilter(filters.rowNameIncludes('design'))

// Reset:
filter.clear()
```

Works with any renderer  the engine recomputes and every renderer repaints.

## API

- `createFilter(options?) → GanttFilter`
  - `options.row` / `options.task`  initial predicates
  - `options.dropEmptyRows`  hide rows whose tasks were all filtered out (default `true`)
- `GanttFilter`: `{ plugin, setRowFilter, setTaskFilter, clear }`
- `filters`: `taskNameIncludes`, `rowNameIncludes`, `taskOverlaps(from, to)`

## Commands

Installing also registers: `filter.setRowFilter`, `filter.setTaskFilter`,
`filter.clear`  callable via `engine.commands.execute(...)`.

## How it works (the plugin pattern)

```ts
const plugin = {
  name: 'filter',
  install(ctx) {
    const off = ctx.hooks.rows.tap(rows => applyFilters(rows)) // reshape data
    ctx.commands.register('filter.clear', () => { /* ... */ })  // expose actions
    return off                                                  // cleanup on remove
  },
}
```

## License

MIT
