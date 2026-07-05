/** A state-change listener. Receives the next and previous snapshots. */
export type StoreListener<T> = (state: Readonly<T>, prev: Readonly<T>) => void

/** A partial update or an updater function producing one. */
export type StoreUpdate<T> = Partial<T> | ((state: Readonly<T>) => Partial<T>)

/**
 * Minimal framework-agnostic reactive store.
 *
 * Holds an immutable snapshot, applies shallow patches, and notifies
 * subscribers synchronously. UI plugins bridge `subscribe` to their own
 * reactivity (Vue refs, signals, manual re-render, …).
 */
export class Store<T extends object> {
  private state: T
  private readonly listeners = new Set<StoreListener<T>>()
  private notifying = false

  constructor(initial: T) {
    this.state = initial
  }

  /** Current immutable snapshot. */
  get(): Readonly<T> {
    return this.state
  }

  /**
   * Apply a shallow patch. Subscribers fire only if the reference changes.
   * A patch that produces no changed keys is a no-op (no notification).
   */
  set(update: StoreUpdate<T>): void {
    const patch = typeof update === 'function' ? update(this.state) : update
    let changed = false
    for (const key in patch) {
      if (patch[key] !== this.state[key as keyof T]) {
        changed = true
        break
      }
    }
    if (!changed)
      return

    const prev = this.state
    this.state = { ...this.state, ...patch }
    this.emit(prev)
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: StoreListener<T>): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(prev: T): void {
    if (this.notifying)
      throw new Error('GanttKit: store.set() called re-entrantly from a listener')
    this.notifying = true
    try {
      for (const listener of [...this.listeners])
        listener(this.state, prev)
    }
    finally {
      this.notifying = false
    }
  }
}
