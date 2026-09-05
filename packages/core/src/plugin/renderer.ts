import type { GanttRow } from '../types'
import type { GanttPlugin } from '../engine-types'

/**
 * Content for a tree chevron: a markup string (plain text/emoji, an inline
 * `<svg>…</svg>`, or an `<img src>`), or a DOM node built by the caller. Nodes
 * are cloned per row, so a single node may be reused across rows.
 */
export type ChevronContent = string | Node

/**
 * Customize the tree chevron. Either fixed content for the two states, or a
 * function invoked per tree row (e.g. to vary the icon by level or row data).
 */
export type ChevronOption =
  | { collapsed: ChevronContent, expanded: ChevronContent }
  | ((state: { expanded: boolean, row: GanttRow }) => ChevronContent)

/**
 * The options every base renderer accepts. Shared so the three shipped
 * renderers stay interchangeable and a caller can swap one for another without
 * touching anything else.
 */
export interface RendererOptions {
  /** Element (or selector) to render into. */
  target: HTMLElement | string
  /** Initial theme. Toggle later via the `data-theme` attribute. */
  theme?: 'light' | 'dark'
  /** Enable ctrl/⌘ + wheel to change view mode. Default `true`. */
  enableZoom?: boolean
  /** Enable click-drag panning of the chart body. Default `true`. */
  enablePan?: boolean
  /**
   * Custom tree expand/collapse chevron. Accepts a markup string (text, emoji,
   * inline SVG or an `<img>`) or a DOM node, either as fixed collapsed/expanded
   * content or a per-row function. Defaults to `▸`/`▾`.
   */
  chevron?: ChevronOption
}

/**
 * A base renderer, as a plugin factory: `htmlRenderer`, `svgRenderer` and
 * `canvasRenderer` all match this, which is what lets a framework binding take
 * the renderer as an option instead of hard-wiring one.
 */
export type RendererFactory = (options: RendererOptions) => GanttPlugin
