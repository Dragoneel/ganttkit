---
"@ganttkit/angular": minor
"@ganttkit/react": minor
"@ganttkit/vue": minor
---

Add Vue 3, React 19 and Angular bindings.

Each package is a thin component over `@ganttkit/html` rather than a new
renderer: the engine still computes the scene and the DOM renderer still paints
it, so every feature plugin works unchanged. The bindings own the renderer's
lifetime and map the options to the framework's reactivity - `rows`, `viewMode`,
`theme` and `dateAdapter` are pushed into the running engine, construction-time
options rebuild it, and `plugins`/`chevron` are read once per engine.

- `@ganttkit/vue` - a `<GanttChart>` component plus a `useGantt` composable.
- `@ganttkit/react` - a `<GanttChart>` component plus a `useGantt` hook.
- `@ganttkit/angular` - a `<gantt-chart>` standalone component, published in the
  Angular Package Format so the app's build links it.
