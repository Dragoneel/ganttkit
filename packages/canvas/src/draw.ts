import type { Scene, ScenePolygon, ScenePrimitive } from '@ganttkit/core'

/**
 * Canvas has no CSS cascade, so unlike the SVG/HTML renderers it cannot let a
 * stylesheet colour the primitives  it must resolve colours itself. This module
 * reads the theme's `--gk-*` custom properties off the root element (so light/
 * dark and user overrides still work) and maps each primitive's well-known class
 * to a 2D-context style. It also hit-tests pointer positions against the scene,
 * since there are no per-shape DOM nodes to use `closest()` on.
 */

const FONT = 'system-ui, -apple-system, sans-serif'

/** Resolved theme colours, read once per paint from the root's CSS variables. */
export interface Palette {
  weekendBg: string
  todayBg: string
  grid: string
  gridWeekend: string
  bar: string
  barStroke: string
  label: string
  dep: string
  milestone: string
  milestoneStroke: string
  accent: string
  progress: string
  marker: string
  markerBand: string
  baseline: string
  textMuted: string
}

/** Bar modifier classes → [fill, stroke], mirroring the SVG/HTML stylesheets. */
const TASK_FILLS: Record<string, [string, string]> = {
  'task-completed': ['#86efac', '#22c55e'],
  'task-in-progress': ['#93c5fd', '#3b82f6'],
  'task-high-priority': ['#fca5a5', '#ef4444'],
}

/** Read the GanttKit theme variables off `root` (via `getComputedStyle`). */
export function readPalette(root: HTMLElement): Palette {
  const cs = getComputedStyle(root)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  return {
    weekendBg: v('--gk-weekend-bg'),
    todayBg: v('--gk-today-bg'),
    grid: v('--gk-grid'),
    gridWeekend: v('--gk-grid-weekend'),
    bar: v('--gk-bar'),
    barStroke: v('--gk-bar-stroke'),
    label: v('--gk-label'),
    dep: v('--gk-dep'),
    milestone: v('--gk-milestone'),
    milestoneStroke: v('--gk-milestone-stroke'),
    accent: v('--gk-accent'),
    progress: v('--gk-progress'),
    marker: v('--gk-marker'),
    markerBand: v('--gk-marker-band'),
    baseline: v('--gk-baseline'),
    textMuted: v('--gk-text-muted'),
  }
}

const has = (prim: ScenePrimitive, cls: string): boolean =>
  prim.className != null && prim.className.split(/\s+/).includes(cls)

/** Parse the `polygon` points list into absolute (translated) coordinates. */
function polygonPoints(node: ScenePolygon): Array<[number, number]> {
  const m = node.transform ? /translate\(\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*\)/.exec(node.transform) : null
  const tx = m ? Number(m[1]) : 0
  const ty = m ? Number(m[2]) : 0
  return node.points.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [(x ?? 0) + tx, (y ?? 0) + ty] as [number, number]
  })
}

/** Parse the `M`/`L` mini-language the engine emits for paths into points. */
function parsePolyline(d: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/gi
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(d)) !== null)
    points.push([Number(m[1]), Number(m[2])])
  return points
}

/** A filled triangular arrowhead at (x,y) pointing along `angle` (radians). */
function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-9, -3)
  ctx.lineTo(-9, 3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Draw a single scene primitive into the 2D context. */
function drawPrimitive(ctx: CanvasRenderingContext2D, prim: ScenePrimitive, p: Palette): void {
  ctx.save()
  switch (prim.type) {
    case 'rect': {
      if (has(prim, 'gantt-handle') || has(prim, 'gantt-connector'))
        break // invisible/interaction-only in the other renderers
      const path = () => {
        ctx.beginPath()
        if (prim.rx != null && typeof ctx.roundRect === 'function')
          ctx.roundRect(prim.x, prim.y, prim.width, prim.height, prim.rx)
        else
          ctx.rect(prim.x, prim.y, prim.width, prim.height)
      }
      if (has(prim, 'gantt-weekend')) {
        ctx.fillStyle = p.weekendBg
        path(); ctx.fill()
      }
      else if (has(prim, 'gantt-today')) {
        ctx.globalAlpha = 0.5
        ctx.fillStyle = p.todayBg
        path(); ctx.fill()
      }
      else if (has(prim, 'gantt-progress')) {
        ctx.fillStyle = p.progress
        path(); ctx.fill()
      }
      else if (has(prim, 'gantt-marker-band')) {
        ctx.fillStyle = p.markerBand
        path(); ctx.fill()
      }
      else if (has(prim, 'gantt-baseline')) {
        ctx.globalAlpha = 0.8
        ctx.strokeStyle = p.baseline
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        path(); ctx.stroke()
      }
      else if (has(prim, 'gantt-selected')) {
        ctx.strokeStyle = p.accent
        ctx.lineWidth = 2
        path(); ctx.stroke()
      }
      else if (has(prim, 'gantt-bar')) {
        const mod = Object.keys(TASK_FILLS).find(c => has(prim, c))
        const [fill, stroke] = mod ? TASK_FILLS[mod]! : [p.bar, p.barStroke]
        ctx.fillStyle = fill
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        path(); ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'line': {
      const weekend = has(prim, 'gantt-gridline--weekend')
      if (has(prim, 'gantt-marker')) {
        ctx.strokeStyle = has(prim, 'is-deadline') ? '#ef4444' : has(prim, 'gantt-marker--today') ? p.accent : p.marker
        ctx.lineWidth = 2
        if (!has(prim, 'gantt-marker--today'))
          ctx.setLineDash([4, 3])
      }
      else {
        ctx.strokeStyle = weekend ? p.gridWeekend : p.grid
        ctx.lineWidth = 1
      }
      ctx.beginPath()
      ctx.moveTo(prim.x1, prim.y1)
      ctx.lineTo(prim.x2, prim.y2)
      ctx.stroke()
      break
    }
    case 'path': {
      const pts = parsePolyline(prim.d)
      if (pts.length < 2)
        break
      ctx.globalAlpha = 0.7
      ctx.strokeStyle = p.dep
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(pts[0]![0], pts[0]![1])
      for (let i = 1; i < pts.length; i++)
        ctx.lineTo(pts[i]![0], pts[i]![1])
      ctx.stroke()
      if (prim.markerEnd) {
        ctx.setLineDash([])
        const [px, py] = pts[pts.length - 2]!
        const [ex, ey] = pts[pts.length - 1]!
        arrowHead(ctx, ex, ey, Math.atan2(ey - py, ex - px), p.dep)
      }
      break
    }
    case 'polygon': {
      const pts = polygonPoints(prim)
      if (!pts.length)
        break
      ctx.fillStyle = p.milestone
      ctx.strokeStyle = p.milestoneStroke
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pts[0]![0], pts[0]![1])
      for (let i = 1; i < pts.length; i++)
        ctx.lineTo(pts[i]![0], pts[i]![1])
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'text': {
      const small = has(prim, 'gantt-label--small')
      const markerLabel = has(prim, 'gantt-marker-label')
      ctx.fillStyle = markerLabel ? p.textMuted : p.label
      const size = markerLabel ? 10 : small ? 9 : 11
      ctx.font = `600 ${size}px ${FONT}`
      ctx.textAlign = prim.anchor === 'middle' ? 'center' : prim.anchor === 'end' ? 'right' : 'left'
      ctx.textBaseline = prim.baseline === 'middle' ? 'middle' : prim.baseline === 'hanging' ? 'top' : 'alphabetic'
      ctx.fillText(prim.text, prim.x, prim.y)
      break
    }
  }
  ctx.restore()
}

/** Paint the whole scene (already translated for the scroll offset). */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): void {
  for (const layer of scene.layers) {
    for (const prim of layer.primitives)
      drawPrimitive(ctx, prim, palette)
  }
}
