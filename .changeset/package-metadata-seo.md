---
"@ganttkit/core": patch
"@ganttkit/svg": patch
"@ganttkit/html": patch
"@ganttkit/canvas": patch
"@ganttkit/angular": patch
"@ganttkit/react": patch
"@ganttkit/vue": patch
"@ganttkit/plugin-baseline": patch
"@ganttkit/plugin-columns": patch
"@ganttkit/plugin-dependencies": patch
"@ganttkit/plugin-filter": patch
"@ganttkit/plugin-i18n": patch
"@ganttkit/plugin-markers": patch
"@ganttkit/plugin-progress": patch
"@ganttkit/plugin-scheduler": patch
"@ganttkit/plugin-selection": patch
"@ganttkit/plugin-toolbar": patch
"@ganttkit/plugin-tooltip": patch
"@ganttkit/plugin-tree": patch
---

Fill in the package metadata npm search runs on.

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
