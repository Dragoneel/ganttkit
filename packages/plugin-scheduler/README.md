# @ganttkit/plugin-scheduler

Resource↔task **assignment scheduling** for GanttKit. Turns a task-oriented
Gantt into a resource-scheduling view and wires up drag-to-assign between two
stacked charts — the pattern used by MS Project's *Team Planner*, Float, Ganttic
and friends.

The whole feature is a plugin: **the core engine is untouched**. It already
allows many bars per row, which is exactly what a resource lane is.

## The model

One source of truth — an **`Assignment`** linking a task to a resource over an
inclusive date window:

```ts
interface Assignment { id: string; taskId: string; resourceId: string; start: DateInput; end: DateInput }
```

From it the plugin derives **resource lanes** (one row per resource; each
assignment → a bar). Because a lane holds many bars, this models both hard cases
for free:

- **A task with multiple resources** — the same `taskId` appears in several lanes.
- **A resource split across tasks** (day 1 on task A, day 2 on task B) — two bars in one lane.

### Availability

Each resource carries an availability calendar — a **working-day pattern** and a
list of **disabled dates**:

```ts
interface Resource {
  id: string; name: string
  workingDays?: Weekday[]        // e.g. ['Mo','Tu','We','Th','Fr'] (default Mon–Fri)
  unavailableDates?: DateInput[] // holidays / PTO — off even on a working weekday
}
```

Non-working weekdays and disabled dates are **shaded** in the lane (style
`.gantt-unavailable`, e.g. light red) and cannot begin a slot selection. Query it
directly with `isResourceAvailable(resource, date)`.

## Pieces

| Export | Role |
| --- | --- |
| `createScheduler(opts)` | Assignment store + `resourcePlugin` (feeds resource lanes via the `rows` hook, draws the drop-hint via the `scene` hook). |
| `createSchedulerDnd(opts)` | Cross-chart drag-to-assign coordinator. Renderer-agnostic (uses the published viewport port). |
| `linkTimelines(opts)` | Keep two+ engines' view-mode and horizontal scroll in lockstep. |

## Usage

```ts
import { createGantt } from '@ganttkit/svg'
import { createColumns } from '@ganttkit/plugin-columns'
import { createScheduler, createSchedulerDnd, linkTimelines } from '@ganttkit/plugin-scheduler'

const scheduler = createScheduler({ resources, tasks, assignments })

// Top chart: resources. Rows come from the plugin; bar-drag is disabled so the
// DnD coordinator owns the gesture. Same explicit date range as the task chart.
const resourceEngine = createGantt({ target: '#resources', rows: [], startDate, endDate, draggable: false })
resourceEngine.use(createColumns({ columns: [{ key: 'name', label: 'Resource' }] }).plugin)
resourceEngine.use(scheduler.resourcePlugin)

// Bottom chart: tasks — the drag source.
const taskEngine = createGantt({ target: '#tasks', rows: taskRows, startDate, endDate, draggable: false })
taskEngine.use(createColumns({ columns: [{ key: 'name', label: 'Task' }] }).plugin)

createSchedulerDnd({
  scheduler,
  task: { engine: taskEngine, root: document.querySelector('#tasks')! },
  resource: { engine: resourceEngine, root: document.querySelector('#resources')! },
  onChange: c => console.log(c.type, c.assignment),
})

linkTimelines({
  engines: [resourceEngine, taskEngine],
  roots: [document.querySelector('#resources')!, document.querySelector('#tasks')!],
})
```

## Interaction

- **Assign** — drag a task bar (bottom) onto a resource lane (top). Drops the same task on several lanes for multi-resource work.
- **Select slots** — **rubber-band drag** free days in resource lanes (plain = replace, Ctrl/⌘ = add), **Ctrl/⌘-click** to toggle individual cells across lanes, **Esc** to clear. Only available, unbooked days are selectable.
- **Slots → task** — drag the selection onto a task to book every selected slot to it. Contiguous days per resource collapse into one assignment.
- **Retime** — drag an assignment bar within its lane.
- **Reassign** — drag an assignment bar to a different lane.
- **Unassign** — drag an assignment bar off the resource chart.

A **drop-hint** (drawn into the scene, so it's pixel-perfect on every renderer)
previews where the bar will land — blue for assign, green for slot selection.

## Styling

Add a `taskClassName` in `createScheduler` to colour assignment bars per task,
and provide these classes (see the SVG `resources` example for a full set):

```css
.gantt-unavailable { fill: rgba(239, 68, 68, 0.14); }              /* light-red off days */
.gantt-drop-hint   { fill: none; stroke: var(--gk-accent); stroke-dasharray: 4 3; }
.gantt-slot-hint   { fill: rgba(16,185,129,.22); stroke: #10b981; } /* slot selection */
.gantt-drag-ghost  { position: fixed; z-index: 1000; pointer-events: none; /* … */ }
```

## License

MIT
