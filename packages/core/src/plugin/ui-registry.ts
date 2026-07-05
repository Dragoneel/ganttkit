import type { GanttEngineApi, GanttEventMap } from '../engine-types'
import type { EventBus } from './event-bus'

/**
 * What a UI contribution receives when the renderer mounts it.
 *
 * `element` is a host the plugin owns and fills with plain DOM. `viewport` is
 * the renderer's scroll container (for positioning/hit-testing). Everything
 * else comes from the engine, so the plugin never reaches into renderer guts.
 */
export interface UiMountContext {
  /** Host element to render into (owned by this contribution). */
  element: HTMLElement
  /** The chart's scroll container  for overlay positioning and pointer math. */
  viewport: HTMLElement
  engine: GanttEngineApi
  events: EventBus<GanttEventMap>
}

/** Imperative mount: populate `ctx.element`; return a disposer to clean up. */
export type UiMount = (ctx: UiMountContext) => void | (() => void)

/** A plugin's request to render UI into a named region. */
export interface UiContribution {
  /** Region to render into. See {@link UI_SLOTS}. */
  slot: string
  /** Sort order within the slot (ascending). Default `0`. */
  order?: number
  /** Optional stable id. */
  id?: string
  mount: UiMount
}

/** Standard slot names a renderer is expected to host. */
export const UI_SLOTS = {
  /** A horizontal bar above the chart. */
  toolbar: 'toolbar',
  /** A `pointer-events:none` layer over the chart (tooltips, menus, rubber-bands). */
  overlay: 'overlay',
} as const

/**
 * Registry of UI contributions. Plugins `register`; the renderer `list`s a slot
 * and mounts each item, re-mounting when the set changes (`subscribe`).
 *
 * The core never touches the DOM  it only stores callbacks. Renderers turn
 * them into elements.
 */
export class UiRegistry {
  private items: UiContribution[] = []
  private readonly listeners = new Set<() => void>()

  /** Register a contribution. Returns a disposer that removes it. */
  register(contribution: UiContribution): () => void {
    this.items.push(contribution)
    this.emit()
    return () => {
      const idx = this.items.indexOf(contribution)
      if (idx !== -1) {
        this.items.splice(idx, 1)
        this.emit()
      }
    }
  }

  /** Contributions for a slot, sorted by `order`. */
  list(slot: string): UiContribution[] {
    return this.items
      .filter(c => c.slot === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  /** Distinct slot names with at least one contribution. */
  slots(): string[] {
    return [...new Set(this.items.map(c => c.slot))]
  }

  /** Subscribe to registration changes (renderer re-mounts). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of [...this.listeners])
      listener()
  }
}
