# @ganttkit/plugin-toolbar

A view-mode / zoom / today toolbar, rendered into the renderer's **toolbar
slot**. One package, works across svg, html, canvas (any renderer that hosts
UI slots the bundled ones do).

```ts
import { toolbarPlugin } from '@ganttkit/plugin-toolbar'
engine.use(toolbarPlugin())
```

Controls (all optional): a view-mode segmented control, zoom in/out (steps the
view mode), and a "Today" button that scrolls the viewport to the current day.

## Options

- `viewModes`  modes for the segmented control. Default `['Day','Week','Month']`.
- `zoom`  show zoom buttons. Default `true`.
- `today`  show the Today button. Default `true`.
- `order`  sort order within the toolbar slot.

Styled via `.gantt__toolbar` / `.gantt__tb-*` in the default theme.

## License

MIT
