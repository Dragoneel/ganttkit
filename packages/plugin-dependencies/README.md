# @ganttkit/plugin-dependencies

Dependency editing and **finish-to-start auto-scheduling**. Dependency *lines*
are already drawn by the core (from each task's `dependencies`); this plugin adds
the behaviour around them. Pure engine-side  works with every renderer.

```ts
import { createDependencies } from '@ganttkit/plugin-dependencies'

const deps = createDependencies({ gap: 0, autoSchedule: true })
engine.use(deps.plugin)

deps.addDependency('design', 'build') // 'build' now depends on 'design'
deps.reschedule()                     // enforce constraints now
```

- **Auto-schedule**: when a task moves (`task:dragend`), dependents shift so none
  start before their predecessor finishes (+ `gap` days). Constraints only push
  tasks later, never pull them earlier.
- **Editing**: `addDependency(predecessorId, successorId)` (rejects cycles and
  self-links), `removeDependency(...)`.
- **Commands**: `deps.add`, `deps.remove`, `deps.reschedule`.

It edits the engine's **source rows**, so it composes correctly with filtering
and tree plugins (hidden rows are still scheduled).

**Drag-to-create links** (`linkDrag`, default `true`): connector handles appear
at each bar's right edge  drag from one to another task to create a dependency.
This uses the renderer's overlay slot, so it needs a slot-hosting renderer (the
bundled ones); it's inert under SSR/headless. You can still create links
programmatically or via the `deps.add` command.

## API

- `createDependencies(options?) → { plugin, addDependency, removeDependency, reschedule }`
  - `gap`  min days between predecessor end and dependent start (default `0`)
  - `autoSchedule`  reschedule on drag (default `true`)
  - `linkDrag`  connector handles + drag-to-create (default `true`)

## License

MIT
