import type { ScenePrimitive } from '@ganttkit/core'

const SVG_NS = 'http://www.w3.org/2000/svg'

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

/** Create an SVG element. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v))
  }
  return el
}

/** Apply the shared scene-node attributes (class, data-*, title). */
function applyBase(el: SVGElement, node: ScenePrimitive): void {
  if (node.className)
    el.setAttribute('class', node.className)
  if (node.data) {
    for (const [k, v] of Object.entries(node.data)) {
      if (v != null)
        el.setAttribute(`data-${k}`, String(v))
    }
  }
  if (node.title) {
    const title = svg('title')
    title.textContent = node.title
    el.appendChild(title)
  }
}

/** Build the concrete SVG element for one scene primitive. */
export function createPrimitive(node: ScenePrimitive): SVGElement {
  switch (node.type) {
    case 'rect': {
      const el = svg('rect', { x: node.x, y: node.y, width: node.width, height: node.height })
      if (node.rx != null)
        el.setAttribute('rx', String(node.rx))
      applyBase(el, node)
      return el
    }
    case 'line': {
      const el = svg('line', { x1: node.x1, y1: node.y1, x2: node.x2, y2: node.y2 })
      applyBase(el, node)
      return el
    }
    case 'path': {
      const el = svg('path', { d: node.d })
      if (node.markerEnd)
        el.setAttribute('marker-end', `url(#${node.markerEnd})`)
      applyBase(el, node)
      return el
    }
    case 'polygon': {
      const el = svg('polygon', { points: node.points })
      if (node.transform)
        el.setAttribute('transform', node.transform)
      applyBase(el, node)
      return el
    }
    case 'text': {
      const el = svg('text', { x: node.x, y: node.y })
      if (node.anchor)
        el.setAttribute('text-anchor', node.anchor)
      if (node.baseline)
        el.setAttribute('dominant-baseline', node.baseline)
      el.textContent = node.text
      applyBase(el, node)
      return el
    }
    default: {
      const _exhaustive: never = node
      throw new Error(`GanttKit/svg: unknown primitive ${(_exhaustive as { type: string }).type}`)
    }
  }
}
