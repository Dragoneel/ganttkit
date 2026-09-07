/**
 * Layer app-wide defaults underneath per-call options.
 *
 * An explicit `undefined` on the caller's side means "I did not set this", not
 * "unset the default" - otherwise spreading a partially-filled options object
 * would silently wipe the `nuxt.config`, and every caller would have to strip
 * its own empty keys before passing them in.
 *
 * The component does not need this: it declares the defaults as Vue prop
 * defaults, so the framework does the layering. This is for `useGantt`, where
 * the options are a plain object the caller assembles.
 *
 * Deliberately generic rather than typed against `GanttChartDefaults`: nothing
 * under `runtime/` imports from outside it, so every file here compiles to a
 * standalone module the way Nuxt expects to consume them.
 */
export function mergeChartOptions<D extends object, T extends object>(defaults: D, options: T): D & T {
  const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined)
      merged[key] = value
  }
  return merged as D & T
}
