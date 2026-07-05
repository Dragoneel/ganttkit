/** A transform applied to a value flowing through a {@link Hook}. */
export type HookFn<T, C = void> = (value: T, context: C) => T

interface Tap<T, C> {
  fn: HookFn<T, C>
  priority: number
}

/**
 * An ordered transform pipeline.
 *
 * Plugins `tap` into a hook to participate in a data flow (e.g. transforming
 * the row set before layout, or the scene before paint). Taps run by ascending
 * `priority` (lower first); ties keep insertion order. Each tap receives the
 * previous tap's output, so order matters and is explicit.
 */
export class Hook<T, C = void> {
  private taps: Tap<T, C>[] = []

  /** Register a transform. Returns a disposer that removes it. */
  tap(fn: HookFn<T, C>, priority = 0): () => void {
    const entry: Tap<T, C> = { fn, priority }
    this.taps.push(entry)
    this.taps.sort((a, b) => a.priority - b.priority)
    return () => {
      const idx = this.taps.indexOf(entry)
      if (idx !== -1)
        this.taps.splice(idx, 1)
    }
  }

  /** Run `value` through every tap and return the final result. */
  run(value: T, context: C): T {
    let result = value
    for (const { fn } of this.taps)
      result = fn(result, context)
    return result
  }

  get size(): number {
    return this.taps.length
  }
}
