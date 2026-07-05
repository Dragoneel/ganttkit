# @ganttkit/core

The headless, framework-agnostic engine behind GanttKit. No DOM, no UI
framework, no runtime dependencies.

It owns the data model, time-scale, layout geometry, interaction logic, reactive
state, and a plugin host  and publishes a declarative **scene** (a list of
backend-neutral **vector primitives**: rect, line, path, polygon, text) for
renderers to paint. An SVG renderer ([`@ganttkit/svg`](https://www.npmjs.com/package/@ganttkit/svg)) maps each
primitive to an SVG element; an HTML renderer ([`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html)) maps
it to a positioned `<div>`; a canvas renderer ([`@ganttkit/canvas`](https://www.npmjs.com/package/@ganttkit/canvas))
draws it to a 2D context; the same scene could drive WebGL, PNG, PDF or terminal
renderers.

```ts
import { GanttEngine } from '@ganttkit/core'

const engine = new GanttEngine({
  rows: [
    { id: 'r1', name: 'Design', tasks: [
      { id: 't1', name: 'Wireframes', start: '2026-07-01', end: '2026-07-08' },
      { id: 't2', name: 'Mockups', start: '2026-07-09', end: '2026-07-20', dependencies: ['t1'] },
    ] },
  ],
  viewMode: 'Week',
})

engine.onSceneChange((scene) => {
  // scene.layers → vector primitives. Paint however you like.
})
engine.setViewMode('Month')
```

## Concepts

| Piece | Responsibility |
| --- | --- |
| `GanttEngine` | Composition root; runs the compute pipeline and hosts plugins |
| `TimeScale` | Day/week/month cells, date↔pixel mapping |
| Layout engine | Per-task geometry, dependency paths |
| `Scene` | Renderer-agnostic vector-primitive description (rect/line/path/polygon/text) |
| `Store` / `EventBus` / `Hook` / `CommandRegistry` / `ServiceRegistry` | Reactive + extension primitives |

The core is intentionally feature-light. Anything optional  the sidebar
columns, filters, view toolbars  is a plugin. The **`ServiceRegistry`**
(`engine.provide` / `engine.consume`) lets a feature plugin publish a capability
that renderers or other plugins look up by key, so the engine never grows
feature-specific surface area.

### Compute pipeline

```
state.rows ─▶ hooks.rows ─▶ deriveDateRange ─▶ TimeScale
          ─▶ computeTaskLayouts ─▶ computeDependencyLinks
          ─▶ buildScene ─▶ hooks.scene ─▶ scene:change
```

## Plugins

A plugin is `{ name, install(ctx) }`. `install` may return a disposer.

```ts
import type { GanttPlugin } from '@ganttkit/core'

const sortByName: GanttPlugin = {
  name: 'sort-by-name',
  install(ctx) {
    return ctx.hooks.rows.tap(rows => [...rows].sort((a, b) => a.name.localeCompare(b.name)))
  },
}

engine.use(sortByName)
```

`ctx` exposes `store`, `events`, `commands`, `services`, `ui`, `hooks`, and `engine`.

## UI slots (plugin DOM)

The scene is the declarative vector-primitive contract. For HTML UI  toolbars, tooltips,
context menus, rubber-bands  plugins contribute through the **UI registry**
(`ctx.ui`): they describe a slot and render plain DOM into a host element the
renderer provides. The same plain-DOM mount works in the SVG/HTML renderers and
inside Vue, so a UI plugin stays a single package.

```ts
import { UI_SLOTS, type GanttPlugin } from '@ganttkit/core'

const banner: GanttPlugin = {
  name: 'banner',
  install(ctx) {
    return ctx.ui.register({
      slot: UI_SLOTS.toolbar, // or UI_SLOTS.overlay
      mount({ element, viewport, engine, events }) {
        element.textContent = 'Hello'
        return () => { /* cleanup */ }
      },
    })
  },
}
```

Standard slots: `toolbar` (a bar above the chart) and `overlay` (a
`pointer-events:none` layer over the chart; children opt into `auto`). The mount
context's `viewport` (scroll element) plus `engine.getTimeScale()` cover
positioning and hit-testing without exposing renderer internals. SSR-safe:
mounts only run where a renderer hosts the slots.

## Virtualization (large datasets)

The engine windows the scene to the renderer's viewport, so cost is bounded by
what's visible  not the dataset size. The renderer reports its viewport; the
engine rebuilds only the visible rows/day-columns (plus overscan):

```ts
engine.setViewport({ scrollTop, scrollLeft, width, height }) // from the scroll container
engine.getWindow() // → { rowStart, rowEnd, dayStart, dayEnd } | null
```

The canvas stays full-size (scrollbars stay correct); only the children change.
At 20 000 tasks this takes the scene from ~90 000 primitives to ~80, and a
scroll rebuild costs well under a millisecond. Two passes keep it cheap:

- `recompute()` (heavy, on data/view change): rows hook → date range → timescale
- `rebuildScene(reason)` (cheap, on scroll/preview): window → layout → scene

`scene:change` carries a `reason` (`'data' | 'viewport' | 'preview'`) so
renderers skip unnecessary work (e.g. rebuilding the header on scroll).

Disable with `virtualize: false`; tune with `overscanRows` / `overscanCols`.
The bundled renderers wire `setViewport` automatically. Drag previews are
windowed too via `engine.setDragPreview(id, start, end)` / `clearDragPreview()`.

## Date adapter

Date math goes through a `DateAdapter`. The default is zero-dependency; inject
your own (dayjs/luxon) via `new GanttEngine({ dateAdapter })`.

For localized calendars use the built-in `Intl` adapter, and swap it at runtime
with `engine.setDateAdapter(...)`:

```ts
import { GanttEngine, createIntlAdapter } from '@ganttkit/core'

const gantt = new GanttEngine({ dateAdapter: createIntlAdapter('fr-FR') })
gantt.setDateAdapter(createIntlAdapter('de-DE')) // recomputes labels
```

`createIntlAdapter(locale, { weekStartsOn?, weekend? })` localizes weekday/month
names and reads first-day-of-week / weekend from the locale (overridable). For
translatable UI strings too, see [`@ganttkit/plugin-i18n`](https://www.npmjs.com/package/@ganttkit/plugin-i18n).

## License

MIT
