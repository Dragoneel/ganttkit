/**
 * @ganttkit/plugin-scheduler  resource↔task assignment scheduling.
 *
 * Turns a task-oriented Gantt into a *resource-scheduling* view. The concept is
 * one source of truth  an {@link Assignment} linking a task to a resource over a
 * date window  from which the plugin derives **resource lanes** (one row per
 * resource, each assignment drawn as a bar in that lane). Because a row can hold
 * many bars, this naturally models:
 *
 * - a task with **multiple resources** (the same `taskId` appears in several lanes), and
 * - a resource working **day 1 on task A, day 2 on task B** (two bars, one lane).
 *
 * The package ships three composable pieces, none of which touch the core engine:
 *
 * 1. {@link createScheduler}  the assignment store + a `resourcePlugin` that
 *    feeds resource lanes into an engine (via the `rows` hook) and draws a live
 *    drop-hint (via the `scene` hook). Renderer-agnostic.
 * 2. {@link createSchedulerDnd}  a cross-chart drag-to-assign coordinator: drag
 *    a task bar onto a resource lane to assign; drag an assignment bar to retime,
 *    reassign, or (off-chart) unassign. Works with any renderer through the
 *    published viewport port.
 * 3. {@link linkTimelines}  keep two (or more) engines' view-mode and horizontal
 *    scroll in lockstep so the stacked charts read as one.
 *
 * ```ts
 * const scheduler = createScheduler({ resources, tasks, assignments })
 * resourceEngine.use(scheduler.resourcePlugin)
 * createSchedulerDnd({ scheduler, task: { engine: taskEngine, root: taskEl }, resource: { engine: resourceEngine, root: resourceEl } })
 * linkTimelines({ engines: [resourceEngine, taskEngine], roots: [resourceEl, taskEl] })
 * ```
 */
import type {
  DateAdapter,
  DateInput,
  GanttEngine,
  GanttEngineApi,
  GanttPlugin,
  GanttRow,
  GanttTask,
  GanttViewportPort,
  Scene,
  SceneLayer,
  ScenePrimitive,
  SceneRect,
} from '@ganttkit/core'
import { GANTT_VIEWPORT_SERVICE, defaultDateAdapter } from '@ganttkit/core'

// --- Domain types ---------------------------------------------------------

/** Two-letter weekday codes, as accepted in a working-day pattern. */
export type Weekday = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su'

/** `Weekday` → JS `Date.getDay()` index (Sun = 0). */
const WEEKDAY_INDEX: Record<Weekday, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 }
/** Default working pattern when a resource doesn't specify one. */
export const DEFAULT_WORKING_DAYS: Weekday[] = ['Mo', 'Tu', 'We', 'Th', 'Fr']

/** A schedulable actor an assignment can be booked against (person, machine, room). */
export interface Resource {
  id: string
  name: string
  /**
   * Working weekdays, e.g. `['Mo','Tu','We','Th','Fr']`. Days outside this set
   * are unavailable. Defaults to {@link DEFAULT_WORKING_DAYS}.
   */
  workingDays?: Weekday[]
  /** Specific unavailable dates (holidays, PTO) — off even on a working weekday. */
  unavailableDates?: DateInput[]
  /** Arbitrary consumer payload, surfaced on the derived row's `meta`. */
  meta?: Record<string, unknown>
}

/** A per-resource, memoised `(date) => isAvailable` predicate. */
function availabilityChecker(resource: Resource, adapter: DateAdapter): (date: Date) => boolean {
  const working = new Set((resource.workingDays ?? DEFAULT_WORKING_DAYS).map(w => WEEKDAY_INDEX[w]))
  const off = new Set((resource.unavailableDates ?? []).map(u => adapter.toKey(adapter.startOfDay(adapter.parse(u)))))
  return (date: Date) => working.has(date.getDay()) && !off.has(adapter.toKey(date))
}

/** Whether a resource is available (a working weekday, not a disabled date) on `date`. */
export function isResourceAvailable(resource: Resource, date: DateInput, adapter: DateAdapter = defaultDateAdapter): boolean {
  return availabilityChecker(resource, adapter)(adapter.startOfDay(adapter.parse(date)))
}

/**
 * A booking of one resource to one task over an inclusive `[start, end]` window.
 * The resource lane draws one bar per assignment; the same `taskId` may appear in
 * many assignments (multi-resource tasks / split work).
 */
export interface Assignment {
  id: string
  taskId: string
  resourceId: string
  start: DateInput
  end: DateInput
  meta?: Record<string, unknown>
}

/** Id prefixes so derived rows/bars never collide with the task engine's ids. */
export const RESOURCE_ROW_PREFIX = 'res:'
export const ASSIGNMENT_TASK_PREFIX = 'asg:'

/** Extract an assignment id from a derived bar's task id (`asg:<id>`), or `null`. */
export function assignmentIdFromTaskId(taskId: string): string | null {
  return taskId.startsWith(ASSIGNMENT_TASK_PREFIX)
    ? taskId.slice(ASSIGNMENT_TASK_PREFIX.length)
    : null
}

export interface SchedulerOptions {
  resources: Resource[]
  /** The tasks being scheduled  used for assignment-bar labels and colours. */
  tasks: GanttTask[]
  /** Initial assignments. Default none. */
  assignments?: Assignment[]
  /** Map a task → CSS class for its assignment bars (colour coding). */
  taskClassName?: (task: GanttTask | undefined) => string | undefined
  /** Label drawn on an assignment bar. Defaults to the task name (or the task id). */
  assignmentLabel?: (assignment: Assignment, task: GanttTask | undefined) => string
  /** Id generator for assignments created by drag-to-assign. Defaults to a counter. */
  createId?: () => string
}

/** A transient preview of where a dragged bar would land, in domain terms. */
export interface DropHint {
  /** Index of the target resource lane (row) in the resource engine. */
  rowIndex: number
  start: DateInput
  /** Whole-day span (inclusive), i.e. `1` for a same-day bar. */
  span: number
  /** `'assign'` (dropping onto a lane) or `'slot'` (selecting a free slot). Default `'assign'`. */
  kind?: 'assign' | 'slot'
}

/** Kinds of change the DnD coordinator reports back. */
export type SchedulerChange =
  | { type: 'assign', assignment: Assignment }
  | { type: 'retime', assignment: Assignment }
  | { type: 'reassign', assignment: Assignment }
  | { type: 'unassign', assignment: Assignment }

/** One selected free slot-day, addressed by resource + day key (robust to reorder/zoom). */
export interface SelectionCell {
  resourceId: string
  /** `YYYY-MM-DD` day key (from the date adapter's `toKey`). */
  dateKey: string
}

/** Internal port the resource plugin publishes so the DnD coordinator can drive overlays. */
const SCHEDULER_HINT_SERVICE = 'gantt:scheduler-hint'
interface HintPort {
  setHint: (hint: DropHint | null) => void
  setSelection: (cells: SelectionCell[]) => void
}

export interface GanttScheduler {
  /** Install on the **resource** engine: feeds resource lanes + draws the drop-hint. */
  readonly resourcePlugin: GanttPlugin
  getResources: () => Resource[]
  setResources: (resources: Resource[]) => void
  getTasks: () => GanttTask[]
  getTask: (id: string) => GanttTask | undefined
  getAssignments: () => Assignment[]
  getAssignment: (id: string) => Assignment | undefined
  /** Assignments booked to one resource. */
  assignmentsForResource: (resourceId: string) => Assignment[]
  /** Assignments of one task (across all resources). */
  assignmentsForTask: (taskId: string) => Assignment[]
  setAssignments: (assignments: Assignment[]) => void
  addAssignment: (assignment: Omit<Assignment, 'id'> & { id?: string }) => Assignment
  updateAssignment: (id: string, patch: Partial<Omit<Assignment, 'id'>>) => Assignment | undefined
  removeAssignment: (id: string) => void
  /** Subscribe to assignment-set changes. Returns an unsubscribe function. */
  subscribe: (listener: (assignments: Assignment[]) => void) => () => void
  /** Pure pivot: resource lanes with each assignment as a task-bar. */
  resourceRows: () => GanttRow[]
}

function insertAfter(scene: Scene, afterName: string, layer: SceneLayer): Scene {
  const idx = scene.layers.findIndex(l => l.name === afterName)
  const layers = scene.layers.slice()
  layers.splice(idx === -1 ? layers.length : idx + 1, 0, layer)
  return { ...scene, layers }
}

export function createScheduler(options: SchedulerOptions): GanttScheduler {
  let resources = [...options.resources]
  let assignments = [...(options.assignments ?? [])]
  const taskIndex = new Map(options.tasks.map(t => [t.id, t]))
  const listeners = new Set<(assignments: Assignment[]) => void>()
  const refreshers = new Set<() => void>()

  let counter = 0
  const createId = options.createId ?? (() => `a${++counter}`)
  const label = options.assignmentLabel
    ?? ((a: Assignment, task: GanttTask | undefined) => task?.name ?? a.taskId)

  function emit(): void {
    for (const fn of refreshers) fn()
    const snapshot = assignments.slice()
    for (const fn of listeners) fn(snapshot)
  }

  function assignmentToTask(a: Assignment): GanttTask {
    const task = taskIndex.get(a.taskId)
    const cls = options.taskClassName?.(task)
    return {
      id: `${ASSIGNMENT_TASK_PREFIX}${a.id}`,
      name: label(a, task),
      start: a.start,
      end: a.end,
      tooltip: task ? `${task.name} — ${a.start} → ${a.end}` : undefined,
      className: cls,
      meta: { assignmentId: a.id, taskId: a.taskId, resourceId: a.resourceId },
    }
  }

  function resourceRows(): GanttRow[] {
    return resources.map(r => ({
      id: `${RESOURCE_ROW_PREFIX}${r.id}`,
      name: r.name,
      meta: { ...r.meta, resourceId: r.id },
      tasks: assignments
        .filter(a => a.resourceId === r.id)
        .map(assignmentToTask),
    }))
  }

  const resourcePlugin: GanttPlugin = {
    name: 'scheduler-resources',
    install(ctx) {
      const refresh = () => ctx.engine.refresh()
      refreshers.add(refresh)

      // Feed resource lanes: this engine's rows ARE the pivot, ignoring input.
      const offRows = ctx.hooks.rows.tap(() => resourceRows())

      // Live drop-hint + persistent slot selection, driven by the DnD coordinator.
      let hint: DropHint | null = null
      let selection: SelectionCell[] = []
      let raf: number | null = null
      const scheduleRepaint = () => {
        if (raf == null && typeof requestAnimationFrame !== 'undefined') {
          raf = requestAnimationFrame(() => {
            raf = null
            ctx.engine.refresh()
          })
        }
        else if (typeof requestAnimationFrame === 'undefined') {
          ctx.engine.refresh()
        }
      }
      const offHint = ctx.engine.provide<HintPort>(SCHEDULER_HINT_SERVICE, {
        setHint(next) {
          hint = next
          scheduleRepaint()
        },
        setSelection(cells) {
          selection = cells
          scheduleRepaint()
        },
      })

      const offScene = ctx.hooks.scene.tap((scene, { scale, options: opts }) => {
        const adapter = opts.dateAdapter
        let next = scene

        // Availability shading: unavailable day-cells per lane, drawn behind the
        // grid/bars. Contiguous unavailable days merge into one rect per lane.
        const rows = ctx.engine.getRows()
        const win = ctx.engine.getWindow()
        const rowStart = win ? win.rowStart : 0
        const rowEnd = win ? win.rowEnd : rows.length
        const dayStart = win ? win.dayStart : 0
        const dayEnd = win ? win.dayEnd : scale.totalDays
        const byId = new Map(resources.map(r => [r.id, r]))
        const shade: ScenePrimitive[] = []
        for (let r = rowStart; r < rowEnd; r++) {
          const row = rows[r]
          if (!row)
            continue
          const res = byId.get(row.meta?.resourceId as string)
          if (!res)
            continue
          const available = availabilityChecker(res, adapter)
          let runStart = -1
          for (let d = dayStart; d <= dayEnd; d++) {
            const day = d < dayEnd ? scale.days[d] : undefined
            const unavailable = day ? !available(day.date) : false
            if (unavailable && runStart === -1) {
              runStart = d
            }
            else if (!unavailable && runStart !== -1) {
              shade.push({
                type: 'rect',
                key: `unavail-${r}-${runStart}`,
                className: 'gantt-unavailable',
                x: runStart * scale.dayWidth,
                y: r * opts.rowHeight,
                width: (d - runStart) * scale.dayWidth,
                height: opts.rowHeight,
              })
              runStart = -1
            }
          }
        }
        if (shade.length > 0)
          next = insertAfter(next, 'backgrounds', { name: 'availability', primitives: shade })

        // Persistent multi-slot selection (built by rubber-band + ctrl-click).
        if (selection.length > 0) {
          const rowByResource = new Map<string, number>()
          for (let r = 0; r < rows.length; r++) {
            const id = rows[r]!.meta?.resourceId as string | undefined
            if (id != null)
              rowByResource.set(id, r)
          }
          const dayByKey = new Map<string, number>()
          for (let d = 0; d < scale.days.length; d++)
            dayByKey.set(scale.days[d]!.key, d)

          const cells: ScenePrimitive[] = []
          for (const cell of selection) {
            const r = rowByResource.get(cell.resourceId)
            const d = dayByKey.get(cell.dateKey)
            if (r == null || d == null)
              continue
            cells.push({
              type: 'rect',
              key: `slot-sel-${cell.resourceId}-${cell.dateKey}`,
              className: 'gantt-slot-selected',
              x: d * scale.dayWidth,
              y: r * opts.rowHeight + opts.barPadding,
              width: scale.dayWidth,
              height: opts.rowHeight - opts.barPadding * 2,
              rx: 3,
            })
          }
          if (cells.length > 0)
            next = insertAfter(next, 'bars', { name: 'slot-selection', primitives: cells })
        }

        // Live drag preview (assign) or slot selection, above the bars.
        if (hint) {
          const rect: SceneRect = {
            type: 'rect',
            key: 'scheduler-drop-hint',
            className: hint.kind === 'slot' ? 'gantt-slot-hint' : 'gantt-drop-hint',
            x: scale.dateToX(adapter.startOfDay(adapter.parse(hint.start))),
            y: hint.rowIndex * opts.rowHeight + opts.barPadding,
            width: Math.max(hint.span, 1) * scale.dayWidth,
            height: opts.rowHeight - opts.barPadding * 2,
            rx: 3,
          }
          next = insertAfter(next, 'bars', { name: 'scheduler-hint', primitives: [rect] })
        }

        return next
      })

      // Paint once so a renderer installed first shows the lanes immediately.
      refresh()

      return () => {
        refreshers.delete(refresh)
        offRows()
        offScene()
        offHint()
        if (raf != null && typeof cancelAnimationFrame !== 'undefined')
          cancelAnimationFrame(raf)
      }
    },
  }

  const controller: GanttScheduler = {
    resourcePlugin,
    getResources: () => resources.slice(),
    setResources(next) {
      resources = [...next]
      emit()
    },
    getTasks: () => [...taskIndex.values()],
    getTask: id => taskIndex.get(id),
    getAssignments: () => assignments.slice(),
    getAssignment: id => assignments.find(a => a.id === id),
    assignmentsForResource: resourceId => assignments.filter(a => a.resourceId === resourceId),
    assignmentsForTask: taskId => assignments.filter(a => a.taskId === taskId),
    setAssignments(next) {
      assignments = [...next]
      emit()
    },
    addAssignment(input) {
      const assignment: Assignment = { ...input, id: input.id ?? createId() }
      assignments = [...assignments, assignment]
      emit()
      return assignment
    },
    updateAssignment(id, patch) {
      let updated: Assignment | undefined
      assignments = assignments.map((a) => {
        if (a.id !== id)
          return a
        updated = { ...a, ...patch, id }
        return updated
      })
      if (updated)
        emit()
      return updated
    },
    removeAssignment(id) {
      const before = assignments.length
      assignments = assignments.filter(a => a.id !== id)
      if (assignments.length !== before)
        emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    resourceRows,
  }

  return controller
}

// --- Cross-chart drag-to-assign coordinator -------------------------------

export interface SchedulerDndEndpoint {
  engine: GanttEngineApi
  /** The renderer's root element (the `.gantt` element). */
  root: HTMLElement
}

export interface SchedulerDndOptions {
  scheduler: GanttScheduler
  /** The task-oriented chart  the drag *source* for new assignments. */
  task: SchedulerDndEndpoint
  /** The resource-oriented chart  the drop *target* (and source for retime/reassign). */
  resource: SchedulerDndEndpoint
  /** Notified after every committed change (handy for logging / persistence). */
  onChange?: (change: SchedulerChange) => void
}

interface ResourceTarget {
  resource: Resource
  rowIndex: number
  dayIndex: number
  /** Day column under the pointer (start-of-day). */
  date: Date
}

interface TaskTarget {
  taskId: string
  taskName: string
}

type DragSource =
  // A task bar (task chart) → dropped on a resource lane to assign.
  | { kind: 'task', taskId: string, span: number }
  // An assignment bar (resource chart) → retime / reassign / (off-chart) unassign.
  | { kind: 'assignment', assignment: Assignment, span: number }

/**
 * Wire drag-to-assign between a task chart and a resource chart. Gestures:
 *
 * - drag a **task bar** onto a **resource lane** → assign;
 * - drag an **assignment bar** within/across lanes → retime/reassign, or off the
 *   resource chart → unassign;
 * - **select free slots** in resource lanes — rubber-band drag (plain = replace,
 *   Ctrl/⌘ = add), Ctrl/⌘-click to toggle single cells, Esc to clear — then drag
 *   the selection onto a **task** to book every selected slot to it (contiguous
 *   days per resource collapse into one assignment).
 *
 * Both charts must have native bar-dragging disabled (`draggable: false`) so this
 * coordinator owns the gesture without conflict. Returns a disposer.
 */
export function createSchedulerDnd(options: SchedulerDndOptions): () => void {
  const { scheduler, task, resource, onChange } = options

  const resVp = resource.engine.consume<GanttViewportPort>(GANTT_VIEWPORT_SERVICE)
  const taskVp = task.engine.consume<GanttViewportPort>(GANTT_VIEWPORT_SERVICE)
  const hint = resource.engine.consume<HintPort>(SCHEDULER_HINT_SERVICE)

  /** Map a client point to the resource lane + day under it, or `null` if outside. */
  function resourceTargetAt(clientX: number, clientY: number): ResourceTarget | null {
    if (!resVp)
      return null
    const p = resVp.clientToScene(clientX, clientY)
    const scene = resource.engine.getScene()
    if (p.x < 0 || p.y < 0 || p.x > scene.width || p.y > scene.height)
      return null
    const { rowHeight } = resource.engine.getOptions()
    const rowIndex = Math.floor(p.y / rowHeight)
    const row = resource.engine.getRows()[rowIndex]
    if (!row)
      return null
    const resourceId = row.meta?.resourceId as string | undefined
    const res = resourceId != null
      ? scheduler.getResources().find(r => r.id === resourceId)
      : undefined
    if (!res)
      return null
    const scale = resource.engine.getTimeScale()
    const dayIndex = Math.max(0, Math.min(scale.totalDays - 1, scale.xToDayIndex(p.x)))
    const date = scale.days[dayIndex]?.date
    if (!date)
      return null
    return { resource: res, rowIndex, dayIndex, date }
  }

  /** Clamp a client point to a resource-grid cell (works even outside the lanes). */
  function gridCellAt(clientX: number, clientY: number): { rowIndex: number, dayIndex: number } | null {
    if (!resVp)
      return null
    const p = resVp.clientToScene(clientX, clientY)
    const scale = resource.engine.getTimeScale()
    const rowCount = resource.engine.getRows().length
    if (rowCount === 0)
      return null
    return {
      rowIndex: Math.max(0, Math.min(rowCount - 1, Math.floor(p.y / resource.engine.getOptions().rowHeight))),
      dayIndex: Math.max(0, Math.min(scale.totalDays - 1, scale.xToDayIndex(p.x))),
    }
  }

  /** Map a client point to the task under it in the task chart, or `null`. */
  function taskTargetAt(clientX: number, clientY: number): TaskTarget | null {
    if (!taskVp)
      return null
    const p = taskVp.clientToScene(clientX, clientY)
    const scene = task.engine.getScene()
    if (p.x < 0 || p.y < 0 || p.x > scene.width || p.y > scene.height)
      return null
    const { rowHeight } = task.engine.getOptions()
    const row = task.engine.getRows()[Math.floor(p.y / rowHeight)]
    if (!row)
      return null
    const taskId = row.tasks[0]?.id ?? row.id
    return { taskId, taskName: scheduler.getTask(taskId)?.name ?? row.tasks[0]?.name ?? row.name }
  }

  const resourceById = (id: string) => scheduler.getResources().find(r => r.id === id)

  /** Whether a day is bookable for a resource: available AND not already assigned. */
  function isFreeDay(res: Resource, date: Date): boolean {
    const adapter = resource.engine.getOptions().dateAdapter
    if (!isResourceAvailable(res, date, adapter))
      return false
    const day = adapter.startOfDay(date)
    return !scheduler.assignmentsForResource(res.id).some((a) => {
      const s = adapter.startOfDay(adapter.parse(a.start))
      const e = adapter.startOfDay(adapter.parse(a.end))
      return day >= s && day <= e
    })
  }

  function spanOf(start: DateInput, end: DateInput): number {
    const adapter = resource.engine.getOptions().dateAdapter
    return Math.max(adapter.diffDays(adapter.parse(start), adapter.parse(end)) + 1, 1)
  }

  let ghost: HTMLElement | null = null
  function showGhost(text: string, clientX: number, clientY: number): void {
    if (!ghost) {
      ghost = document.createElement('div')
      ghost.className = 'gantt-drag-ghost'
      document.body.appendChild(ghost)
    }
    ghost.textContent = text
    ghost.style.left = `${clientX + 12}px`
    ghost.style.top = `${clientY + 12}px`
  }
  function clearGhost(): void {
    ghost?.remove()
    ghost = null
  }

  // --- Slot selection state (resourceId|dateKey) ---------------------------
  const selection = new Set<string>()
  const selKey = (resourceId: string, dateKey: string) => `${resourceId}|${dateKey}`
  const parseKey = (k: string): SelectionCell => {
    const i = k.indexOf('|')
    return { resourceId: k.slice(0, i), dateKey: k.slice(i + 1) }
  }
  const pushSelection = (set: Set<string> = selection) => hint?.setSelection([...set].map(parseKey))

  // --- Task / assignment → resource lane -----------------------------------
  function beginDrag(source: DragSource, downEvent: MouseEvent): void {
    downEvent.preventDefault()
    const adapter = resource.engine.getOptions().dateAdapter
    document.body.classList.add('gantt-scheduling')

    const onMove = (e: MouseEvent) => {
      const target = resourceTargetAt(e.clientX, e.clientY)
      if (target) {
        hint?.setHint({ rowIndex: target.rowIndex, start: target.date, span: source.span })
        const name = source.kind === 'task'
          ? scheduler.getTask(source.taskId)?.name ?? source.taskId
          : scheduler.getTask(source.assignment.taskId)?.name ?? source.assignment.taskId
        showGhost(`${name} → ${target.resource.name} · ${adapter.toKey(target.date)}`, e.clientX, e.clientY)
      }
      else {
        hint?.setHint(null)
        showGhost(source.kind === 'assignment' ? 'Release to unassign' : 'Drop on a resource lane', e.clientX, e.clientY)
      }
    }

    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('gantt-scheduling')
      hint?.setHint(null)
      clearGhost()

      const target = resourceTargetAt(e.clientX, e.clientY)
      if (target) {
        const start = target.date
        const end = adapter.addDays(start, source.span - 1)
        if (source.kind === 'task') {
          const assignment = scheduler.addAssignment({ taskId: source.taskId, resourceId: target.resource.id, start, end })
          onChange?.({ type: 'assign', assignment })
        }
        else {
          const changedResource = target.resource.id !== source.assignment.resourceId
          const updated = scheduler.updateAssignment(source.assignment.id, { resourceId: target.resource.id, start, end })
          if (updated)
            onChange?.({ type: changedResource ? 'reassign' : 'retime', assignment: updated })
        }
      }
      else if (source.kind === 'assignment') {
        // Dropped off the resource chart → unassign.
        scheduler.removeAssignment(source.assignment.id)
        onChange?.({ type: 'unassign', assignment: source.assignment })
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Rubber-band + ctrl-click slot selection -----------------------------
  function beginRubberBand(downEvent: MouseEvent, additive: boolean): void {
    downEvent.preventDefault()
    document.body.classList.add('gantt-scheduling')
    const start = gridCellAt(downEvent.clientX, downEvent.clientY)!
    const base = additive ? new Set(selection) : new Set<string>()
    let moved = false
    let preview = new Set(base)

    const rectCells = (cur: { rowIndex: number, dayIndex: number }): Set<string> => {
      const next = new Set(base)
      const scale = resource.engine.getTimeScale()
      const rows = resource.engine.getRows()
      const r0 = Math.min(start.rowIndex, cur.rowIndex)
      const r1 = Math.max(start.rowIndex, cur.rowIndex)
      const d0 = Math.min(start.dayIndex, cur.dayIndex)
      const d1 = Math.max(start.dayIndex, cur.dayIndex)
      for (let r = r0; r <= r1; r++) {
        const res = resourceById(rows[r]?.meta?.resourceId as string)
        if (!res)
          continue
        for (let d = d0; d <= d1; d++) {
          const day = scale.days[d]
          if (day && isFreeDay(res, day.date))
            next.add(selKey(res.id, day.key))
        }
      }
      return next
    }

    const onMove = (e: MouseEvent) => {
      const cur = gridCellAt(e.clientX, e.clientY)
      if (!cur)
        return
      if (cur.rowIndex !== start.rowIndex || cur.dayIndex !== start.dayIndex)
        moved = true
      preview = rectCells(cur)
      pushSelection(preview)
      showGhost(`${preview.size} slot${preview.size === 1 ? '' : 's'} selected`, e.clientX, e.clientY)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('gantt-scheduling')
      clearGhost()

      if (moved) {
        selection.clear()
        for (const k of preview) selection.add(k)
      }
      else {
        // A click (no drag): toggle (additive) or replace with just this cell.
        const scale = resource.engine.getTimeScale()
        const res = resourceById(resource.engine.getRows()[start.rowIndex]?.meta?.resourceId as string)
        const day = scale.days[start.dayIndex]
        const free = res && day ? isFreeDay(res, day.date) : false
        if (additive) {
          if (res && day && free) {
            const k = selKey(res.id, day.key)
            if (selection.has(k))
              selection.delete(k)
            else
              selection.add(k)
          }
        }
        else {
          selection.clear()
          if (res && day && free)
            selection.add(selKey(res.id, day.key))
        }
      }
      pushSelection()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Drag the current selection onto a task ------------------------------
  function beginSelectionDrag(downEvent: MouseEvent): void {
    downEvent.preventDefault()
    document.body.classList.add('gantt-scheduling')
    const count = selection.size

    const onMove = (e: MouseEvent) => {
      const taskT = taskTargetAt(e.clientX, e.clientY)
      const noun = `${count} slot${count === 1 ? '' : 's'}`
      showGhost(taskT ? `${noun} → ${taskT.taskName}` : `${noun} · drop on a task`, e.clientX, e.clientY)
    }

    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('gantt-scheduling')
      clearGhost()
      const taskT = taskTargetAt(e.clientX, e.clientY)
      if (taskT) {
        assignSelectionToTask(taskT.taskId)
        selection.clear()
        pushSelection()
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /** Book every selected slot to a task; contiguous days per resource merge into one assignment. */
  function assignSelectionToTask(taskId: string): void {
    const days = resource.engine.getTimeScale().days
    const indexByKey = new Map(days.map((d, i) => [d.key, i]))
    const byResource = new Map<string, number[]>()
    for (const k of selection) {
      const { resourceId, dateKey } = parseKey(k)
      const idx = indexByKey.get(dateKey)
      if (idx == null)
        continue
      const list = byResource.get(resourceId) ?? []
      list.push(idx)
      byResource.set(resourceId, list)
    }
    for (const [resourceId, indexes] of byResource) {
      indexes.sort((a, b) => a - b)
      let runStart = indexes[0]!
      let prev = indexes[0]!
      const flush = (end: number) => {
        const assignment = scheduler.addAssignment({ taskId, resourceId, start: days[runStart]!.date, end: days[end]!.date })
        onChange?.({ type: 'assign', assignment })
      }
      for (let i = 1; i < indexes.length; i++) {
        const cur = indexes[i]!
        if (cur === prev + 1) {
          prev = cur
        }
        else {
          flush(prev)
          runStart = cur
          prev = cur
        }
      }
      flush(prev)
    }
  }

  // --- Press routing --------------------------------------------------------

  // Task chart: a task bar → assign to a resource lane.
  const onTaskDown = (e: MouseEvent) => {
    if (e.button !== 0)
      return
    const el = (e.target as Element).closest('[data-task-id]')
    const taskId = el?.getAttribute('data-task-id')
    if (!taskId)
      return
    const t = scheduler.getTask(taskId)
    beginDrag({ kind: 'task', taskId, span: t ? spanOf(t.start, t.end) : 1 }, e)
  }

  // Resource chart: assignment bar → retime/reassign/unassign; selected cell →
  // drag selection to a task; empty area → rubber-band / ctrl-click selection.
  const onResourceDown = (e: MouseEvent) => {
    if (e.button !== 0)
      return
    const el = (e.target as Element).closest('[data-task-id]')
    const barId = el?.getAttribute('data-task-id')
    if (barId) {
      const assignmentId = assignmentIdFromTaskId(barId)
      const assignment = assignmentId ? scheduler.getAssignment(assignmentId) : undefined
      if (!assignment)
        return
      beginDrag({ kind: 'assignment', assignment, span: spanOf(assignment.start, assignment.end) }, e)
      return
    }
    const resT = resourceTargetAt(e.clientX, e.clientY)
    if (!resT)
      return
    const day = resource.engine.getTimeScale().days[resT.dayIndex]
    const additive = e.ctrlKey || e.metaKey
    // Plain press on an already-selected cell → drag the whole selection to a task.
    if (!additive && day && selection.has(selKey(resT.resource.id, day.key))) {
      beginSelectionDrag(e)
      return
    }
    beginRubberBand(e, additive)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selection.size > 0) {
      selection.clear()
      pushSelection()
    }
  }

  task.root.addEventListener('mousedown', onTaskDown)
  resource.root.addEventListener('mousedown', onResourceDown)
  document.addEventListener('keydown', onKeyDown)

  return () => {
    task.root.removeEventListener('mousedown', onTaskDown)
    resource.root.removeEventListener('mousedown', onResourceDown)
    document.removeEventListener('keydown', onKeyDown)
    clearGhost()
    document.body.classList.remove('gantt-scheduling')
  }
}

// --- Timeline sync --------------------------------------------------------

export interface LinkTimelinesOptions {
  /** Engines to keep on the same view-mode. */
  engines: GanttEngine[]
  /** Their renderer roots  keeps horizontal scroll in lockstep. */
  roots?: HTMLElement[]
}

/**
 * Keep multiple engines' **view-mode** and (optionally) **horizontal scroll** in
 * lockstep, so stacked charts read as a single timeline. Pass the same explicit
 * `startDate`/`endDate` to every engine so their date→pixel mapping is identical.
 * Returns a disposer.
 */
export function linkTimelines(options: LinkTimelinesOptions): () => void {
  const { engines, roots = [] } = options
  const offs: Array<() => void> = []

  // View-mode sync (guarded against feedback loops).
  let syncingMode = false
  for (const engine of engines) {
    offs.push(engine.events.on('viewmode:change', ({ viewMode }) => {
      if (syncingMode)
        return
      syncingMode = true
      for (const other of engines) {
        if (other !== engine && other.getState().viewMode !== viewMode)
          other.setViewMode(viewMode)
      }
      syncingMode = false
    }))
  }

  // Horizontal scroll sync across renderer bodies.
  const bodies = roots
    .map(r => r.querySelector<HTMLElement>('.gantt__body'))
    .filter((b): b is HTMLElement => b != null)
  let syncingScroll = false
  for (const body of bodies) {
    const onScroll = () => {
      if (syncingScroll)
        return
      syncingScroll = true
      for (const other of bodies) {
        if (other !== body && other.scrollLeft !== body.scrollLeft)
          other.scrollLeft = body.scrollLeft
      }
      if (typeof requestAnimationFrame !== 'undefined')
        requestAnimationFrame(() => { syncingScroll = false })
      else
        syncingScroll = false
    }
    body.addEventListener('scroll', onScroll, { passive: true })
    offs.push(() => body.removeEventListener('scroll', onScroll))
  }

  return () => offs.forEach(off => off())
}
