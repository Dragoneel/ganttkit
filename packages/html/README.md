# @ganttkit/html

A plain **HTML/CSS/JS** renderer for [GanttKit](../core)  the DOM-twin of
[`@ganttkit/svg`](../svg).

Both packages consume the exact same renderer-agnostic **scene** the engine
produces (a flat list of *vector primitives*: `rect`, `line`, `path`, `polygon`,
`text`). `@ganttkit/svg` maps each primitive 1:1 onto an SVG element; this
package paints each one as a positioned `<div>` styled with
`background`/`border`/`clip-path` instead. Because the primitives carry the same
`data-*` attributes, every feature plugin (columns, tree, dependencies,
markers, tooltip, selection, …) works unchanged.

The scene model is deliberately backend-neutral, so the same primitives can feed
other renderers in the future  canvas, WebGL, PNG, PDF, or even a terminal.

## Usage

```ts
import { createGantt } from '@ganttkit/html'
import '@ganttkit/html/styles.css'

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
import { htmlRenderer } from '@ganttkit/html'

const engine = new GanttEngine({ rows })
engine.use(htmlRenderer({ target: '#app' }))
```

## How primitives map to the DOM

| Vector primitive | HTML rendering                                              |
| ---------------- | ---------------------------------------------------------- |
| `rect`           | positioned `<div>` (`background` + `border`, `rx`→`border-radius`) |
| `line`           | zero-height `<div>` whose `border-top` is the stroke, rotated to any angle |
| `path`           | the `M`/`L` polyline split into per-segment stroke boxes, plus a CSS-triangle arrowhead for `markerEnd` |
| `polygon`        | a `<div>` clipped to the points via `clip-path: polygon(...)` |
| `text`           | a positioned `<div>`; SVG anchor/baseline emulated with a `translate(...)` |

## Examples

- [`examples/basic`](examples/basic)  `pnpm --filter @ganttkit/example-html dev`
- [`examples/stress`](examples/stress)  large-dataset benchmark with a live
  metrics panel: `pnpm --filter @ganttkit/example-html-stress dev`
