/**
 * A generic capability registry: plugins `provide` a service under a string
 * key, and renderers or other plugins `consume` it.
 *
 * This is how the core stays agnostic of optional features. For example, a
 * columns/sidebar plugin publishes a sidebar service that renderers look up 
 * the engine itself knows nothing about columns. Keys are conventions shared
 * between the provider and its consumers (e.g. `'gantt:sidebar'`).
 */
export class ServiceRegistry {
  private readonly services = new Map<string, unknown>()

  /** Publish a service. Returns a disposer that removes it. Keys are unique. */
  provide<T>(key: string, service: T): () => void {
    if (this.services.has(key))
      throw new Error(`GanttKit: service "${key}" is already provided`)
    this.services.set(key, service)
    return () => {
      if (this.services.get(key) === service)
        this.services.delete(key)
    }
  }

  /** Look up a service, or `undefined` if no plugin provides it. */
  consume<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined
  }

  has(key: string): boolean {
    return this.services.has(key)
  }
}
