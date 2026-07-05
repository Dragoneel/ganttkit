/**
 * A renderer-provided port that maps client (screen) coordinates to scene
 * coordinates. Published under {@link GANTT_VIEWPORT_SERVICE} so coordinate-
 * mapping plugins (rubber-band selection, hover) ask the renderer "where is this
 * pointer in scene space?" instead of reaching into renderer-specific DOM. Each
 * renderer implements it from its own geometry (an SVG/HTML surface rect, or a
 * canvas rect plus scroll offset).
 */
export interface GanttViewportPort {
  /** Map a client (screen) point to scene coordinates. */
  clientToScene: (clientX: number, clientY: number) => { x: number, y: number }
}

/** Service key a renderer publishes its {@link GanttViewportPort} under. */
export const GANTT_VIEWPORT_SERVICE = 'gantt:viewport'
