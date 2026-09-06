---
"@ganttkit/angular": patch
"@ganttkit/react": patch
"@ganttkit/vue": patch
---

Document which stylesheet goes with which renderer.

`@ganttkit/<framework>/styles.css` stays the default: it re-exports the HTML
renderer's sheet, which is what the bindings paint with unless `renderer` says
otherwise, and `@ganttkit/html` is a hard dependency so it always resolves.

Pick another renderer and you import its stylesheet from its own package
(`@ganttkit/svg/styles.css`, `@ganttkit/canvas/styles.css`) - the same package
you import the renderer from. Re-exporting those through the binding was tried
and does not work: they are optional peers, so under pnpm's strict layout the
binding cannot resolve them even once the app has installed them, and the
failure surfaces as an unresolved CSS import rather than a clear error.
