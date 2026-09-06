# @ganttkit/core

## 0.2.0

### Minor Changes

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
