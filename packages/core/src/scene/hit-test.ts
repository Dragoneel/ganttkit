/**
 * Point hit-testing against the scene. The engine owns this so no renderer has
 * to re-implement hit geometry  SVG/HTML can rely on the DOM, while canvas,
 * WebGL or any future backend converts a pointer position to scene coordinates
 * and asks the engine what's under it.
 */
import type { Scene, ScenePolygon, ScenePrimitive } from './scene-types'

/** Result of a point hit-test against the scene. */
export interface GanttHit {
  /** The task the point falls on. */
  taskId: string
  /** Set when the point is over a resize handle at a bar's edge. */
  handle: 'left' | 'right' | null
}

const TRANSLATE = /translate\(\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*\)/

/** Whether a point lies within a polygon's (translated) bounding box. */
function polygonContains(node: ScenePolygon, x: number, y: number): boolean {
  const m = node.transform ? TRANSLATE.exec(node.transform) : null
  const tx = m ? Number(m[1]) : 0
  const ty = m ? Number(m[2]) : 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const pair of node.points.trim().split(/\s+/)) {
    const [px, py] = pair.split(',').map(Number)
    const ax = (px ?? 0) + tx
    const ay = (py ?? 0) + ty
    if (ax < minX)
      minX = ax
    if (ax > maxX)
      maxX = ax
    if (ay < minY)
      minY = ay
    if (ay > maxY)
      maxY = ay
  }
  return x >= minX && x <= maxX && y >= minY && y <= maxY
}

function contains(prim: ScenePrimitive, x: number, y: number): boolean {
  if (prim.type === 'rect')
    return x >= prim.x && x <= prim.x + prim.width && y >= prim.y && y <= prim.y + prim.height
  if (prim.type === 'polygon')
    return polygonContains(prim, x, y)
  return false
}

/**
 * Find the topmost task primitive under a point in scene coordinates. Walks
 * layers and primitives back-to-front, so the visually-top shape wins and a
 * resize handle (painted above its bar) is preferred over the bar body.
 */
export function hitTestScene(scene: Scene, x: number, y: number): GanttHit | null {
  for (let li = scene.layers.length - 1; li >= 0; li--) {
    const prims = scene.layers[li]!.primitives
    for (let pi = prims.length - 1; pi >= 0; pi--) {
      const prim = prims[pi]!
      const raw = prim.taskId ?? prim.data?.['task-id']
      if (raw == null)
        continue
      if (contains(prim, x, y)) {
        const handle = prim.data?.handle
        return { taskId: String(raw), handle: handle === 'left' || handle === 'right' ? handle : null }
      }
    }
  }
  return null
}

/**
 * Task ids whose bars intersect a rectangle in scene coordinates (corners in any
 * order). Used for rubber-band selection  renderers map the drag rectangle into
 * scene space and call this rather than scanning the scene themselves.
 */
export function hitTestRegion(scene: Scene, x1: number, y1: number, x2: number, y2: number): string[] {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  const bars = scene.layers.find(l => l.name === 'bars')?.primitives ?? []
  const ids: string[] = []
  for (const prim of bars) {
    if (prim.type !== 'rect')
      continue
    const raw = prim.taskId ?? prim.data?.['task-id']
    if (raw == null)
      continue
    if (prim.x < maxX && prim.x + prim.width > minX && prim.y < maxY && prim.y + prim.height > minY)
      ids.push(String(raw))
  }
  return ids
}
