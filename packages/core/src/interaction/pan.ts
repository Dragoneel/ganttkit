/** Snapshot of scroll position captured when a pan gesture begins. */
export interface PanOrigin {
  pointerX: number
  pointerY: number
  scrollLeft: number
  scrollTop: number
}

/**
 * Given a pan origin and the current pointer position, return the scroll
 * offsets the viewport should adopt. Renderers apply these to their scroll
 * container; the engine stays unaware of the DOM.
 */
export function resolvePan(origin: PanOrigin, pointerX: number, pointerY: number): {
  scrollLeft: number
  scrollTop: number
} {
  return {
    scrollLeft: origin.scrollLeft - (pointerX - origin.pointerX),
    scrollTop: origin.scrollTop - (pointerY - origin.pointerY),
  }
}
