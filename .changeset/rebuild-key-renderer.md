---
"@ganttkit/angular": patch
"@ganttkit/react": patch
"@ganttkit/vue": patch
---

Rebuild the chart when the `renderer` option is swapped.

`rebuildKey` is a `JSON.stringify` of the construction-time options, and
`JSON.stringify` turns a function into `null`. The renderer factory was
therefore invisible to the key: swapping `htmlRenderer` for `canvasRenderer`
produced an unchanged key and the old renderer kept painting.

Non-serializable build options now get a stable id from a `WeakMap`, so the same
factory always hashes the same and a different one always differs.
