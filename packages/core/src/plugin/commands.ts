/** A registered, invocable command. */
export type Command = (...args: never[]) => unknown

/**
 * A name → function registry.
 *
 * Plugins expose imperative actions (e.g. `view.setMode`, `filter.set`) as
 * commands so UI (toolbars, shortcuts) can invoke them without importing the
 * plugin directly. Names are unique; re-registering throws.
 */
export class CommandRegistry {
  private readonly commands = new Map<string, Command>()

  register(name: string, command: Command): () => void {
    if (this.commands.has(name))
      throw new Error(`GanttKit: command "${name}" is already registered`)
    this.commands.set(name, command)
    return () => {
      if (this.commands.get(name) === command)
        this.commands.delete(name)
    }
  }

  has(name: string): boolean {
    return this.commands.has(name)
  }

  /** Invoke a command by name. Throws if it is not registered. */
  execute<R = unknown>(name: string, ...args: unknown[]): R {
    const command = this.commands.get(name)
    if (!command)
      throw new Error(`GanttKit: command "${name}" is not registered`)
    return command(...(args as never[])) as R
  }

  list(): string[] {
    return [...this.commands.keys()]
  }
}
