# @ganttkit/plugin-tooltip

A hover card for tasks, rendered into the renderer's **overlay slot** and
positioned by the pointer. One package, works across svg, html, canvas.

```ts
import { tooltipPlugin } from '@ganttkit/plugin-tooltip'
engine.use(tooltipPlugin())

// custom content:
engine.use(tooltipPlugin({
  content: (task, row) => `${row.name}: ${task.name}  ${Math.round((task.progress ?? 0) * 100)}%`,
}))
```

The default card shows the task name, start→end, and completion. `content` may
return a string (set as HTML) or an `HTMLElement`.

## Options

- `content(task, row)`  custom card content.
- `order`  sort order within the overlay slot.

Styled via `.gantt__tooltip` in the default theme.

## License

MIT
