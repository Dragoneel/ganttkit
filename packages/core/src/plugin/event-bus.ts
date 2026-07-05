/**
 * Generic, typed publish/subscribe bus.
 *
 * `Events` maps an event name to its payload type. It is intentionally
 * unconstrained so plain `interface` event maps (which lack an index signature)
 * are accepted.
 */
export class EventBus<Events> {
  private readonly handlers = new Map<keyof Events, Set<(payload: never) => void>>()

  /** Subscribe to `type`. Returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as (payload: never) => void)
    return () => this.off(type, handler)
  }

  /** Subscribe for a single emission, then auto-unsubscribe. */
  once<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    const off = this.on(type, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  off<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): void {
    this.handlers.get(type)?.delete(handler as (payload: never) => void)
  }

  /** Emit `payload` to all `type` subscribers. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type)
    if (!set)
      return
    for (const handler of [...set])
      (handler as (p: Events[K]) => void)(payload)
  }

  /** Remove every handler (used on engine teardown). */
  clear(): void {
    this.handlers.clear()
  }
}
