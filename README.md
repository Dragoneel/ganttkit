# GanttKit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 20.12](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

A **framework-agnostic, plugin-driven Gantt chart engine**.

GanttKit splits a Gantt chart into a **headless engine** and **thin plugins**:

- **`@ganttkit/core`**  the engine. Owns the data model, time-scale, layout
  geometry, interaction logic, reactive state, and a plugin host. It touches no
  DOM and depends on no UI framework. It emits a declarative **scene**  a plain
  list of backend-neutral **vector primitives** (rects, lines, paths, polygons,
  text)  that any renderer can paint.
- **UI plugins**  paint the scene and forward pointer events back to the
  engine. The same scene drives every backend:
  - **`@ganttkit/svg`**  plain HTML/CSS/JS renderer; maps each primitive to an SVG element.
  - **`@ganttkit/html`**  plain HTML/CSS/JS renderer; maps each primitive to a positioned `<div>`.
  - **`@ganttkit/canvas`**  plain HTML/CSS/JS renderer; draws each primitive to a 2D `<canvas>`.
- **Feature plugins**  extend behaviour through the plugin API:
  - **`@ganttkit/plugin-columns`**  the sidebar columns (deliberately *not* in
    the core; renderers draw a sidebar only when this is installed).
  - **`@ganttkit/plugin-filter`**  filter/sort rows via the data pipeline.
  - **`@ganttkit/plugin-progress`**  completion fill inside task bars.
  - **`@ganttkit/plugin-markers`**  vertical date markers / bands (today line, deadlines, sprints).
  - **`@ganttkit/plugin-tree`**  hierarchical rows with expand/collapse.
  - **`@ganttkit/plugin-dependencies`**  finish-to-start auto-scheduling + drag-to-create links.
  - **`@ganttkit/plugin-baseline`**  planned-vs-actual ghost bars.
  - **`@ganttkit/plugin-toolbar`**  view-mode / zoom / today toolbar.
  - **`@ganttkit/plugin-tooltip`**  hover detail card.
  - **`@ganttkit/plugin-selection`**  select / rubber-band / context menu.
  - **`@ganttkit/plugin-i18n`**  localized dates + translatable strings.
  - **`@ganttkit/plugin-scheduler`**  resource↔task assignment scheduling: resource lanes, cross-chart drag-to-assign, synced timelines.

```
@ganttkit/core (no UI) ──emits──▶ Scene (vector primitives)
        │                              ▲
        │ GanttContext                 │ paint + pointer events
        ▼                              │
   feature plugins         UI plugins (svg, html, canvas, vue, …)
```

## Why this shape?

- **Built for scale.** The engine virtualizes the scene to the renderer's
  viewport, so a 20k-task chart paints ~80 SVG nodes instead of ~90,000 and
  scrolls with sub-millisecond rebuilds. See [`@ganttkit/core`](packages/core#virtualization-large-datasets).
- **One layout, many renderers.** Geometry is computed once in the core; UI
  plugins never re-derive it. The same scene drives SVG, HTML and canvas
  backends; adding React/Svelte/Angular or WebGL/PDF = a new thin renderer.
- **Primitive efficiency.** The scene is described as vector primitives, so an
  SVG renderer maps them straight to `<rect>`/`<line>`/`<path>` with no diff-heavy DOM.
- **Testable.** The engine is pure logic  unit-tested without a browser.
- **Composable.** Features (filters, columns, view management, table side-view)
  are plugins that hook the same context, not forks of the component.

## Quick start

```bash
pnpm install
pnpm build        # build every package
pnpm test         # run core unit tests
```

See each package's `examples/` directory for runnable demos.

## Packages

| Package | Description |
| --- | --- |
| [`@ganttkit/core`](packages/core) | Headless engine + plugin host |
| [`@ganttkit/svg`](packages/svg) | Vanilla SVG renderer (primitive → SVG element) |
| [`@ganttkit/html`](packages/html) | Vanilla HTML renderer (primitive → `<div>`) |
| [`@ganttkit/canvas`](packages/canvas) | Vanilla canvas renderer (primitive → 2D context) |
| [`@ganttkit/plugin-columns`](packages/plugin-columns) | Sidebar columns feature plugin |
| [`@ganttkit/plugin-filter`](packages/plugin-filter) | Row filtering feature plugin |
| [`@ganttkit/plugin-progress`](packages/plugin-progress) | Task completion fill |
| [`@ganttkit/plugin-markers`](packages/plugin-markers) | Date markers / bands |
| [`@ganttkit/plugin-tree`](packages/plugin-tree) | Hierarchical rows (expand/collapse) |
| [`@ganttkit/plugin-dependencies`](packages/plugin-dependencies) | Auto-scheduling + drag-to-create links |
| [`@ganttkit/plugin-baseline`](packages/plugin-baseline) | Planned-vs-actual ghost bars |
| [`@ganttkit/plugin-toolbar`](packages/plugin-toolbar) | View-mode / zoom / today toolbar |
| [`@ganttkit/plugin-tooltip`](packages/plugin-tooltip) | Hover detail card |
| [`@ganttkit/plugin-selection`](packages/plugin-selection) | Select / rubber-band / context menu |
| [`@ganttkit/plugin-i18n`](packages/plugin-i18n) | Localized dates + translatable strings |
| [`@ganttkit/plugin-scheduler`](packages/plugin-scheduler) | Resource↔task assignment scheduling (drag-to-assign, synced charts) |

## Extending: services

The core stays feature-agnostic via a tiny **service registry**. A feature
plugin can `provide` a capability under a key, and renderers `consume` it. The
sidebar works exactly this way: `@ganttkit/plugin-columns` publishes a sidebar
model under `'gantt:sidebar'`, and the renderers draw a sidebar only if that
service is present. The engine itself knows nothing about columns.

For HTML UI (toolbars, tooltips, menus, rubber-bands) plugins use the **UI slot**
registry (`ctx.ui`): they render plain DOM into a host the renderer provides, so
one plugin works across svg/html/canvas/vue/react/...

See [`@ganttkit/core` › UI slots](packages/core#ui-slots-plugin-dom).

## License

MIT
