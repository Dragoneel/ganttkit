import type { TaskLayout } from './layout-engine'

/** A resolved dependency link with a ready-to-render SVG path. */
export interface DependencyLink {
  sourceTaskId: string
  targetTaskId: string
  /** SVG path `d` describing an orthogonal elbow from source end to target start. */
  path: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Horizontal stub length before the elbow turns. */
const ELBOW = 20

/**
 * Build dependency links between task layouts.
 *
 * For each task, every id in `task.dependencies` that resolves to a known task
 * produces a finish-to-start elbow: from the source's right edge to the
 * target's left edge (milestones anchor at their marker point).
 */
export function computeDependencyLinks(layouts: TaskLayout[]): DependencyLink[] {
  const byId = new Map<string, TaskLayout>()
  for (const layout of layouts)
    byId.set(layout.task.id, layout)

  const links: DependencyLink[] = []

  for (const target of layouts) {
    const deps = target.task.dependencies
    if (!deps || deps.length === 0)
      continue

    // Milestones connect at their marker (end); tasks at their start edge.
    const x2 = target.isMilestone ? target.x + target.width : target.x
    const y2 = target.cy

    for (const depId of deps) {
      const source = byId.get(depId)
      if (!source)
        continue

      const x1 = source.x + source.width
      const y1 = source.cy

      links.push({
        sourceTaskId: depId,
        targetTaskId: target.task.id,
        x1,
        y1,
        x2,
        y2,
        path: `M ${x1} ${y1} L ${x1 + ELBOW} ${y1} L ${x1 + ELBOW} ${y2} L ${x2} ${y2}`,
      })
    }
  }

  return links
}
