---
"@ganttkit/angular": minor
"@ganttkit/react": minor
"@ganttkit/vue": minor
---

Add Vue 3, React 19 and Angular bindings.

Each package is a binding, not a fourth renderer: the engine still computes the
scene and a base renderer still paints it, so every feature plugin works
unchanged. The binding owns the renderer's lifetime and maps the options onto
the framework's reactivity. `rows`, `viewMode`, `theme` and `dateAdapter` are
pushed into the running engine, construction-time options rebuild it, and
`plugins`/`chevron` are read once per engine.

- `@ganttkit/vue` - a `<GanttChart>` component plus a `useGantt` composable.
- `@ganttkit/react` - a `<GanttChart>` component plus a `useGantt` hook.
- `@ganttkit/angular` - a `<gantt-chart>` standalone component, published in the
  Angular Package Format so the app's build links it.

They paint with `@ganttkit/html` by default. Pass `renderer` to use
`@ganttkit/svg` or `@ganttkit/canvas` instead.
