import type { ScenePrimitive, SceneText, VectorPrimitive } from '@ganttkit/core'

/** Create an HTML element with optional class and attributes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string | number>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className)
    el.className = className
  if (attrs) {
    for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v))
  }
  return el
}

/** Apply the shared scene-node attributes (class, data-*, title) to a box. */
function applyBase(el: HTMLElement, node: VectorPrimitive): void {
  if (node.className)
    el.className = node.className
  if (node.data) {
    for (const [k, v] of Object.entries(node.data)) {
      if (v != null)
        el.setAttribute(`data-${k}`, String(v))
    }
  }
  if (node.title)
    el.title = node.title
}

/** An absolutely-positioned, empty box  the canvas every primitive draws into. */
function box(): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  return el
}

/**
 * A straight stroke from (x1,y1) to (x2,y2), drawn as a zero-height box whose
 * `border-top` is the visible line. Works at any angle: the box is rotated about
 * its start so the same code handles the grid (axis-aligned) and dependency
 * elbows. Colour/width/dash all live in the CSS class via `border-top`.
 */
function stroke(x1: number, y1: number, x2: number, y2: number): HTMLElement {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const el = box()
  el.style.left = `${x1}px`
  el.style.top = `${y1}px`
  el.style.width = `${len}px`
  el.style.height = '0'
  el.style.transformOrigin = '0 0'
  el.style.transform = `rotate(${angle}deg)`
  return el
}

/** Parse the M/L mini-language the engine emits for paths into a point list. */
function parsePolyline(d: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  // Matches `M`/`L` commands followed by two numbers; the engine only ever emits
  // these (orthogonal dependency elbows), so we don't need full path support.
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/gi
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(d)) !== null)
    points.push([Number(m[1]), Number(m[2])])
  return points
}

/** A CSS-triangle arrowhead pointing along `angle`, with its tip at (x,y). */
function arrowHead(x: number, y: number, angle: number): HTMLElement {
  const el = box()
  el.className = 'gantt__html-arrow'
  // The triangle is built from borders: an 8×8 box whose left border is the body
  // and whose tip sits on its right edge  so we anchor that right-centre point.
  el.style.left = `${x - 8}px`
  el.style.top = `${y - 4}px`
  el.style.transformOrigin = '8px 4px'
  el.style.transform = `rotate(${angle}deg)`
  return el
}

function createText(node: SceneText): HTMLElement {
  const el = box()
  el.style.left = `${node.x}px`
  el.style.top = `${node.y}px`
  el.style.whiteSpace = 'nowrap'
  el.textContent = node.text
  // SVG anchors/baselines position relative to the glyph box; emulate with a
  // transform so the same x/y the SVG renderer uses lands in the same place.
  const tx = node.anchor === 'middle' ? '-50%' : node.anchor === 'end' ? '-100%' : '0'
  const ty = node.baseline === 'middle' ? '-50%' : node.baseline === 'hanging' ? '0' : '-100%'
  if (tx !== '0' || ty !== '0')
    el.style.transform = `translate(${tx}, ${ty})`
  applyBase(el, node)
  return el
}

/** Build the HTML element(s) for one vector primitive. */
export function createPrimitive(node: ScenePrimitive): HTMLElement {
  switch (node.type) {
    case 'rect': {
      const el = box()
      el.style.left = `${node.x}px`
      el.style.top = `${node.y}px`
      el.style.width = `${node.width}px`
      el.style.height = `${node.height}px`
      if (node.rx != null)
        el.style.borderRadius = `${node.rx}px`
      applyBase(el, node)
      return el
    }
    case 'line': {
      // Width/style/colour of the line all come from the CSS class' `border-top`.
      const el = stroke(node.x1, node.y1, node.x2, node.y2)
      applyBase(el, node)
      return el
    }
    case 'path': {
      // A path becomes a wrapper holding one stroke box per segment, plus an
      // optional arrowhead  so the engine's class/data/title apply to the group.
      const wrap = box()
      wrap.style.left = '0'
      wrap.style.top = '0'
      const pts = parsePolyline(node.d)
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1]!
        const [x2, y2] = pts[i]!
        const seg = stroke(x1, y1, x2, y2)
        if (node.className)
          seg.className = node.className
        wrap.appendChild(seg)
      }
      if (node.markerEnd && pts.length >= 2) {
        const [px, py] = pts[pts.length - 2]!
        const [ex, ey] = pts[pts.length - 1]!
        const angle = Math.atan2(ey - py, ex - px) * (180 / Math.PI)
        wrap.appendChild(arrowHead(ex, ey, angle))
      }
      // Keep data/title on the wrapper for hit-testing; class stays on segments.
      if (node.data) {
        for (const [k, v] of Object.entries(node.data)) {
          if (v != null)
            wrap.setAttribute(`data-${k}`, String(v))
        }
      }
      if (node.title)
        wrap.title = node.title
      return wrap
    }
    case 'polygon': {
      const el = box()
      const pts = node.points.trim().split(/\s+/).map((p) => {
        const [x, y] = p.split(',').map(Number)
        return [x ?? 0, y ?? 0] as [number, number]
      })
      const xs = pts.map(p => p[0])
      const ys = pts.map(p => p[1])
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const width = Math.max(...xs) - minX
      const height = Math.max(...ys) - minY
      // Points are authored around the origin (with negatives) and placed via a
      // `translate(tx,ty)` transform. Shift the box to that origin's bounding-box
      // corner, then clip to the polygon normalised into the box.
      const [tx, ty] = parseTranslate(node.transform)
      el.style.left = `${tx + minX}px`
      el.style.top = `${ty + minY}px`
      el.style.width = `${width}px`
      el.style.height = `${height}px`
      el.style.clipPath = `polygon(${pts.map(([x, y]) => `${x - minX}px ${y - minY}px`).join(', ')})`
      applyBase(el, node)
      return el
    }
    case 'text':
      return createText(node)
    default: {
      const _exhaustive: never = node
      throw new Error(`GanttKit/html: unknown primitive ${(_exhaustive as { type: string }).type}`)
    }
  }
}

/** Read `tx`/`ty` out of a `translate(tx, ty)` transform string. */
function parseTranslate(transform?: string): [number, number] {
  if (!transform)
    return [0, 0]
  const m = /translate\(\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*\)/.exec(transform)
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}
