---
"@ganttkit/plugin-baseline": minor
"@ganttkit/plugin-columns": minor
"@ganttkit/plugin-dependencies": minor
"@ganttkit/plugin-filter": minor
"@ganttkit/plugin-i18n": minor
"@ganttkit/plugin-markers": minor
"@ganttkit/plugin-progress": minor
"@ganttkit/plugin-scheduler": minor
"@ganttkit/plugin-selection": minor
"@ganttkit/plugin-toolbar": minor
"@ganttkit/plugin-tooltip": minor
"@ganttkit/plugin-tree": minor
"@ganttkit/angular": minor
"@ganttkit/react": minor
"@ganttkit/vue": minor
---

Widen the `@ganttkit/*` peer ranges from an exact pin to `>=0.1.0`.

These were `workspace:*`, which publishes as the exact current version. A plugin
released at 0.1.2 therefore demanded `@ganttkit/core@0.1.2` precisely, so every
core release - patches included - put every installed plugin out of range.

The plugin API has not broken, and a plugin works against any core from 0.1.0
on, so the range now says that. Same for the optional `@ganttkit/svg` and
`@ganttkit/canvas` peers on the framework bindings.
