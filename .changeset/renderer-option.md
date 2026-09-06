---
"@ganttkit/core": minor
"@ganttkit/html": minor
"@ganttkit/svg": minor
"@ganttkit/canvas": minor
"@ganttkit/angular": minor
"@ganttkit/react": minor
"@ganttkit/vue": minor
---

Let the framework bindings pick their base renderer.

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
