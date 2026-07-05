# @ganttkit/svg

Plain HTML/CSS/JS **SVG** renderer for [`@ganttkit/core`](https://www.npmjs.com/package/@ganttkit/core). No framework
required. It maps the engine's renderer-agnostic vector primitives 1:1 onto SVG
elements. For DOM-element or canvas-based alternatives see
[`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html) and [`@ganttkit/canvas`](https://www.npmjs.com/package/@ganttkit/canvas).

```ts
import { createGantt } from '@ganttkit/svg'
import '@ganttkit/svg/styles.css'

const gantt = createGantt({
  target: '#app', // element or selector
  rows: [
    { id: 'r1', name: 'Design', tasks: [
      { id: 't1', name: 'Wireframes', start: '2026-07-01', end: '2026-07-08' },
    ] },
  ],
  viewMode: 'Week',
  theme: 'light',
})

gantt.setViewMode('Month')
gantt.events.on('task:dragend', ({ task, start, end, changed }) => {
  if (changed) console.log(task.id, start, end)
})
```

`createGantt` returns the underlying `GanttEngine`, so you can call `setRows`,
`use(...)` more plugins, subscribe to events, etc.

## As a plugin

`createGantt` is sugar over the renderer plugin:

```ts
import { GanttEngine } from '@ganttkit/core'
import { svgRenderer } from '@ganttkit/svg'

const engine = new GanttEngine({ rows })
engine.use(svgRenderer({ target: '#app', theme: 'dark' }))
```

## Sidebar (columns)

The sidebar is a feature plugin, not built in. Install
[`@ganttkit/plugin-columns`](https://www.npmjs.com/package/@ganttkit/plugin-columns); the renderer draws a sidebar
only when it is present, otherwise the timeline is full-width.

```ts
import { createColumns } from '@ganttkit/plugin-columns'

const gantt = createGantt({ target: '#app', rows })
gantt.use(createColumns({
  sidebarWidth: 220,
  columns: [{ key: 'name', label: 'Task' }, { key: 'owner', label: 'Owner', width: 80 }],
}).plugin)
```

## Interactions

- **Drag** a bar to move it; drag its **edges** to resize.
- **Ctrl/⌘ + wheel** changes the view mode (disable with `enableZoom: false`).
- **Drag empty space** to pan (disable with `enablePan: false`).

## Theming

All colours are CSS variables scoped to `.gantt`. Switch themes via the
`data-theme="light|dark"` attribute, or override variables in your own CSS.

## Examples

- [`examples/basic`](examples/basic)  `pnpm --filter @ganttkit/example-svg dev`
- [`examples/stress`](examples/stress)  large-dataset benchmark (up to 20k tasks)
  with a live metrics panel: `pnpm --filter @ganttkit/example-svg-stress dev`

## License

MIT
