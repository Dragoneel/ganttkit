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
---

Minor improvements, and a version bump to keep the whole monorepo on one line at
0.2.0.

No behaviour changes: every plugin works against the same engine contract it did
before, and the new `renderer` option on the framework bindings needs nothing
from them, because a plugin never knew which renderer was painting.

What did change is the packaging and the prose: npm metadata that search
actually reads, and README/doc-comment punctuation.
