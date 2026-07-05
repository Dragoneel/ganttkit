/**
 * The scene model: a renderer-agnostic description of what to draw, expressed as
 * a flat list of **vector primitives** (rect, line, path, polygon, text). The
 * engine produces them; a renderer maps each primitive onto whatever its backend
 * draws with  SVG elements, HTML/CSS boxes, a canvas/WebGL context, or a
 * PNG/PDF/terminal rasteriser. No geometry math happens in the renderer.
 *
 * Coordinates are CSS pixels in an SVG-style space (origin top-left, y down).
 * `path.d` and `polygon.points` use the SVG path/points mini-language so that an
 * SVG renderer can pass them through verbatim; non-SVG renderers parse them.
 */

/** Attributes shared by every primitive. */
export interface SceneNodeBase {
  /** Stable key for list reconciliation in framework renderers. */
  key: string
  /** Space-separated CSS classes. */
  className?: string
  /** `data-*` attributes (used for hit-testing and styling hooks). */
  data?: Record<string, string | number | boolean | undefined>
  /** When set, the primitive represents this task and should forward pointer events. */
  taskId?: string
  /** Native `<title>` tooltip text. */
  title?: string
}

export interface SceneRect extends SceneNodeBase {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  rx?: number
}

export interface SceneLine extends SceneNodeBase {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ScenePath extends SceneNodeBase {
  type: 'path'
  d: string
  /** Reference to a renderer-provided marker, e.g. `'gantt-arrow'`. */
  markerEnd?: string
}

export interface ScenePolygon extends SceneNodeBase {
  type: 'polygon'
  /** SVG points list, e.g. `'0,-12 3,-5 …'`. */
  points: string
  /** Optional transform, e.g. `'translate(120, 25)'`. */
  transform?: string
}

export interface SceneText extends SceneNodeBase {
  type: 'text'
  x: number
  y: number
  text: string
  anchor?: 'start' | 'middle' | 'end'
  baseline?: 'auto' | 'middle' | 'hanging'
}

/** Union of every drawable vector primitive. */
export type ScenePrimitive = SceneRect | SceneLine | ScenePath | ScenePolygon | SceneText

/**
 * Generic alias for {@link ScenePrimitive}. A "vector primitive" is the
 * backend-neutral unit a renderer consumes; the SVG renderer happens to map it
 * 1:1 to an SVG element, but an HTML, canvas, WebGL, PNG, PDF or terminal
 * renderer can map the same primitive onto its own drawing model.
 */
export type VectorPrimitive = ScenePrimitive

/**
 * A named group of primitives. Layers paint in array order, so later layers sit
 * on top. Plugins may add or reorder layers via the `scene` hook.
 */
export interface SceneLayer {
  name: string
  primitives: ScenePrimitive[]
}

/** Everything a renderer needs to paint one frame of the chart body. */
export interface Scene {
  width: number
  height: number
  layers: SceneLayer[]
}

/** Standard marker ids a renderer is expected to provide in its `<defs>`. */
export const SCENE_MARKERS = {
  arrow: 'gantt-arrow',
} as const
