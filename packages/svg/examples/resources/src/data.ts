import type { GanttRow, GanttTask } from '@ganttkit/core'
import type { Assignment, Resource } from '@ganttkit/plugin-scheduler'

/** Shared timeline window — passed to BOTH engines so their date→pixel maps align. */
export const START_DATE = '2026-06-29'
export const END_DATE = '2026-08-02'

/**
 * The people/teams work is booked against → the top chart's lanes.
 *
 * `workingDays` sets each lane's availability pattern; `unavailableDates` marks
 * specific days off (holidays / PTO). Non-working weekdays and disabled dates are
 * shaded light-red in the lane and can't start a slot selection.
 */
export const resources: Resource[] = [
  // Standard week, but off for a mid-July long weekend.
  { id: 'alice', name: 'Alice (Design)', workingDays: ['Mo', 'Tu', 'We', 'Th', 'Fr'], unavailableDates: ['2026-07-13', '2026-07-14'] },
  // Works Saturdays too.
  { id: 'bob', name: 'Bob (Frontend)', workingDays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] },
  // Four-day week (off Fridays).
  { id: 'carla', name: 'Carla (Backend)', workingDays: ['Mo', 'Tu', 'We', 'Th'] },
  // Standard week with a single day off.
  { id: 'dan', name: 'Dan (QA)', workingDays: ['Mo', 'Tu', 'We', 'Th', 'Fr'], unavailableDates: ['2026-07-22'] },
]

/** The tasks being scheduled → the bottom chart's rows and the drag source. */
export const tasks: GanttTask[] = [
  { id: 't1', name: 'Wireframes', start: '2026-07-01', end: '2026-07-07' },
  { id: 't2', name: 'UI mockups', start: '2026-07-06', end: '2026-07-14' },
  { id: 't3', name: 'API', start: '2026-07-08', end: '2026-07-20' },
  { id: 't4', name: 'Web app', start: '2026-07-15', end: '2026-07-28' },
  { id: 't5', name: 'Test & release', start: '2026-07-24', end: '2026-07-31' },
]

/**
 * A colour per task, so an assignment bar is recognisable in any lane.
 * Classes are defined in the example stylesheet.
 */
const TASK_COLORS: Record<string, string> = {
  t1: 'asg--c1',
  t2: 'asg--c2',
  t3: 'asg--c3',
  t4: 'asg--c4',
  t5: 'asg--c5',
}
export const taskClassName = (task: GanttTask | undefined): string | undefined =>
  task ? TASK_COLORS[task.id] : undefined

/**
 * Seed assignments. Note Alice on day-by-day split work: wireframes early in the
 * week, then straight onto mockups — two bars in one lane.
 */
export const assignments: Assignment[] = [
  { id: 's1', taskId: 't1', resourceId: 'alice', start: '2026-07-01', end: '2026-07-03' },
  { id: 's2', taskId: 't2', resourceId: 'alice', start: '2026-07-06', end: '2026-07-10' },
  { id: 's3', taskId: 't3', resourceId: 'carla', start: '2026-07-08', end: '2026-07-17' },
  // t4 is a multi-resource task: Bob and Carla both work it.
  { id: 's4', taskId: 't4', resourceId: 'bob', start: '2026-07-15', end: '2026-07-24' },
  { id: 's5', taskId: 't4', resourceId: 'carla', start: '2026-07-20', end: '2026-07-28' },
  { id: 's6', taskId: 't5', resourceId: 'dan', start: '2026-07-24', end: '2026-07-31' },
]

/** The bottom chart's rows — one per task, showing each task's own span. */
export const taskRows: GanttRow[] = tasks.map(task => ({
  id: task.id,
  name: task.name,
  tasks: [{ ...task, className: taskClassName(task) }],
}))
