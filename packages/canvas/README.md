# @ganttkit/canvas

A plain **HTML/CSS/JS** renderer for [GanttKit](../core) that draws the chart
into a single **2D `<canvas>`** the third sibling of
[`@ganttkit/svg`](../svg) (primitive → SVG element) and
[`@ganttkit/html`](../html) (primitive → `<div>`).

All three consume the exact same renderer-agnostic **scene** of vector
primitives (`rect`, `line`, `path`, `polygon`, `text`), so every feature plugin
(columns, tree, dependencies, markers, tooltip, selection, …) works unchanged.

## Usage

```ts
import { createGantt } from '@ganttkit/canvas'
import '@ganttkit/canvas/styles.css'

const gantt = createGantt({
  target: '#app',
  rows,
  viewMode: 'Week',
  highlightToday: true,
})
```

Or attach it as a plugin to an existing engine:

```ts
import { GanttEngine } from '@ganttkit/core'
import { canvasRenderer } from '@ganttkit/canvas'

const engine = new GanttEngine({ rows })
engine.use(canvasRenderer({ target: '#app' }))
```

## How it differs from the DOM renderers

Canvas is immediate-mode, so two things work differently behind the same API:

- **Viewport-sized canvas.** A canvas can't be millions of pixels tall, so it is
  kept the size of the *visible viewport* and pinned over a full-size spacer that
  drives the scrollbars. On every scroll the engine re-windows the scene and the
  renderer redraws with the scroll offset applied  cost stays bounded by what's
  visible, no matter the dataset size.
- **No CSS cascade.** There are no per-shape DOM nodes, so the renderer resolves
  colours itself from the theme's `--gk-*` CSS variables (light/dark and your
  overrides still apply). Pointer gestures are resolved through the engine's
  shared `engine.hitTest(x, y)`  the renderer maps the pointer into scene
  coordinates and lets the engine say what's under it, rather than re-inventing
  hit geometry. The stylesheet still ships the variables and the chrome (header,
  sidebar, toolbar/overlay slots).

## Interactions

- **Drag** a bar to move it; drag its **edges** to resize.
- **Ctrl/⌘ + wheel** changes the view mode (disable with `enableZoom: false`).
- **Drag empty space** to pan (disable with `enablePan: false`).

## Examples

- [`examples/basic`](examples/basic)  `pnpm --filter @ganttkit/example-canvas dev`
- [`examples/stress`](examples/stress)  large-dataset benchmark with a live
  metrics panel: `pnpm --filter @ganttkit/example-canvas-stress dev`

## License

MIT
