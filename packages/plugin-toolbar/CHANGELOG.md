# @ganttkit/plugin-toolbar

## 0.2.0

### Minor Changes

- 3f62c52: Widen the `@ganttkit/*` peer ranges from an exact pin to `>=0.1.0`.

  These were `workspace:*`, which publishes as the exact current version. A plugin
  released at 0.1.2 therefore demanded `@ganttkit/core@0.1.2` precisely, so every
  core release - patches included - put every installed plugin out of range.

  The plugin API has not broken, and a plugin works against any core from 0.1.0
  on, so the range now says that. Same for the optional `@ganttkit/svg` and
  `@ganttkit/canvas` peers on the framework bindings.

- 3f62c52: Minor improvements, and a version bump to keep the whole monorepo on one line at
  0.2.0.

  No behaviour changes: every plugin works against the same engine contract it did
  before, and the new `renderer` option on the framework bindings needs nothing
  from them, because a plugin never knew which renderer was painting.

  What did change is the packaging and the prose: npm metadata that search
  actually reads, and README/doc-comment punctuation.

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
