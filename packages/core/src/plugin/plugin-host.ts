import type { GanttContext, GanttPlugin } from '../engine-types'

interface InstalledPlugin {
  plugin: GanttPlugin
  dispose?: () => void
}

/**
 * Manages a plugin's lifecycle: install (capturing any returned disposer),
 * lookup, and teardown. Names are unique so a plugin can be found and removed.
 */
export class PluginHost {
  private readonly installed = new Map<string, InstalledPlugin>()

  constructor(private readonly context: GanttContext) {}

  use(plugin: GanttPlugin): void {
    if (this.installed.has(plugin.name))
      throw new Error(`GanttKit: plugin "${plugin.name}" is already installed`)
    const dispose = plugin.install(this.context) || undefined
    this.installed.set(plugin.name, { plugin, dispose })
  }

  has(name: string): boolean {
    return this.installed.has(name)
  }

  remove(name: string): void {
    const entry = this.installed.get(name)
    if (!entry)
      return
    entry.dispose?.()
    this.installed.delete(name)
  }

  list(): string[] {
    return [...this.installed.keys()]
  }

  /** Dispose every plugin in reverse install order. */
  destroy(): void {
    for (const name of [...this.installed.keys()].reverse())
      this.remove(name)
  }
}
