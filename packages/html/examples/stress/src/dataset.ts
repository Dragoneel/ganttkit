import type { GanttRow, GanttTask } from '@ganttkit/core'

export interface DatasetStats {
  rows: number
  tasks: number
  dependencies: number
  milestones: number
}

export interface Dataset {
  rows: GanttRow[]
  stats: DatasetStats
}

/** Deterministic PRNG so successive runs at the same size are comparable. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CLASSES = ['task-completed', 'task-in-progress', 'task-high-priority', '']

/** Resources grouped under one parent "code" row (shows a tree chevron). */
const GROUP_SIZE = 20

function isoDay(dayOfYear: number): string {
  // Day 1 = 2026-01-01; JS Date rolls overflow into later months/years.
  const d = new Date(2026, 0, dayOfYear)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Generate a synthetic Gantt dataset.
 *
 * Rows are spread across the year so the timeline has realistic width; tasks
 * within a row chain sequentially with occasional dependencies and a trailing
 * milestone. Total tasks = `rowCount * tasksPerRow`.
 */
export function generateDataset(rowCount: number, tasksPerRow: number): Dataset {
  const rand = mulberry32(rowCount * 1000 + tasksPerRow)
  const rows: GanttRow[] = []
  let tasks = 0
  let dependencies = 0
  let milestones = 0
  let groups = 0

  for (let r = 0; r < rowCount; r++) {
    // Open a new parent "code" group every GROUP_SIZE resources. The tree
    // plugin turns these `parentId` links into an expand/collapse chevron,
    // shown in whichever column is configured as the tree column.
    if (r % GROUP_SIZE === 0) {
      rows.push({ id: `CODE-${String(groups).padStart(3, '0')}`, name: `Code group ${groups}`, tasks: [] })
      groups++
    }
    const parentId = `CODE-${String(groups - 1).padStart(3, '0')}`

    const rowTasks: GanttTask[] = []
    let cursor = 1 + (r % 11) * 30 + Math.floor(rand() * 15)
    let prevId: string | null = null

    for (let t = 0; t < tasksPerRow; t++) {
      const id = `r${r}t${t}`
      const duration = 2 + Math.floor(rand() * 10)
      const startDay = cursor
      const isMilestone = t === tasksPerRow - 1 && rand() < 0.3
      const endDay = isMilestone ? startDay : startDay + duration
      cursor = endDay + 1 + Math.floor(rand() * 4)

      const deps = prevId && rand() < 0.6 ? [prevId] : undefined
      if (deps)
        dependencies += deps.length
      if (isMilestone)
        milestones++

      rowTasks.push({
        id,
        name: `Task ${r}.${t}`,
        start: isoDay(startDay),
        end: isoDay(endDay),
        kind: isMilestone ? 'milestone' : 'task',
        className: CLASSES[Math.floor(rand() * CLASSES.length)] || undefined,
        dependencies: deps,
      })
      tasks++
      prevId = id
    }

    rows.push({ id: `R${String(r).padStart(5, '0')}`, name: `Resource ${r}`, parentId, tasks: rowTasks })
  }

  return { rows, stats: { rows: rows.length, tasks, dependencies, milestones } }
}
