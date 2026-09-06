# @ganttkit/react

## 0.2.0

### Minor Changes

- 80f63a6: Add Vue 3, React 19 and Angular bindings.

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

- 3f62c52: Widen the `@ganttkit/*` peer ranges from an exact pin to `>=0.1.0`.

  These were `workspace:*`, which publishes as the exact current version. A plugin
  released at 0.1.2 therefore demanded `@ganttkit/core@0.1.2` precisely, so every
  core release - patches included - put every installed plugin out of range.

  The plugin API has not broken, and a plugin works against any core from 0.1.0
  on, so the range now says that. Same for the optional `@ganttkit/svg` and
  `@ganttkit/canvas` peers on the framework bindings.

- 02d5a82: Let the framework bindings pick their base renderer.

  The three shipped renderers already had the same shape - a plugin factory taking
  `target`, `theme`, `enableZoom`, `enablePan` and `chevron` - but each declared it
  separately and the bindings hard-wired `htmlRenderer`. That contract now lives in
  core as `RendererOptions` / `RendererFactory` (with `ChevronOption` and
  `ChevronContent` alongside it), the renderer packages re-export it, and
  `<GanttChart>` takes a `renderer` option:

  ```ts
  import { canvasRenderer } from '@ganttkit/canvas'
  import '@ganttkit/canvas/styles.css'

  <GanttChart :renderer="canvasRenderer" :rows="rows" />
  ```

  It defaults to `htmlRenderer`, so existing code is unaffected. `@ganttkit/svg`
  and `@ganttkit/canvas` are optional peers of the bindings - install the one you
  use. Any factory matching `RendererFactory` works, so a custom renderer drops in
  the same way.

### Patch Changes

- f0fff8c: Fill in the package metadata npm search runs on.

  Every package now carries `keywords` (a shared set that competes for the broad
  searches, plus its own niche terms), `homepage` pointing at ganttkit.org, and
  `bugs` pointing at the issue tracker. None of the three were set anywhere.

  Descriptions are rewritten to lead with the terms people actually search, and
  each one now says "Gantt chart" rather than assuming the reader already knows
  what GanttKit is. Several also had a stray double space where an em-dash had
  been stripped, which npm rendered verbatim.

  The three framework bindings were still described as "renderer plugin ... over
  the HTML renderer", which stopped being true when they gained the `renderer`
  option.

- f36199b: Rebuild the chart when the `renderer` option is swapped.

  `rebuildKey` is a `JSON.stringify` of the construction-time options, and
  `JSON.stringify` turns a function into `null`. The renderer factory was
  therefore invisible to the key: swapping `htmlRenderer` for `canvasRenderer`
  produced an unchanged key and the old renderer kept painting.

  Non-serializable build options now get a stable id from a `WeakMap`, so the same
  factory always hashes the same and a different one always differs.

- 0ba757a: Document which stylesheet goes with which renderer.

  `@ganttkit/<framework>/styles.css` stays the default: it re-exports the HTML
  renderer's sheet, which is what the bindings paint with unless `renderer` says
  otherwise, and `@ganttkit/html` is a hard dependency so it always resolves.

  Pick another renderer and you import its stylesheet from its own package
  (`@ganttkit/svg/styles.css`, `@ganttkit/canvas/styles.css`) - the same package
  you import the renderer from. Re-exporting those through the binding was tried
  and does not work: they are optional peers, so under pnpm's strict layout the
  binding cannot resolve them even once the app has installed them, and the
  failure surfaces as an unresolved CSS import rather than a clear error.

- Updated dependencies [f0fff8c]
- Updated dependencies [02d5a82]
  - @ganttkit/core@0.2.0
  - @ganttkit/html@0.2.0
