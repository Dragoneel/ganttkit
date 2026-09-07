/**
 * Local stand-in for the module `src/module.ts` generates at build time.
 *
 * In an app the same declaration arrives from `addTypeTemplate`, pointed at the
 * published entry. This copy exists so this package typechecks on its own,
 * without a `.nuxt` directory to generate first, and is not published.
 */
declare module '#ganttkit-options' {
  type Options = import('../src/types').GanttKitRuntimeOptions
  export const renderer: Options['renderer']
  export const defaults: Options['defaults']
}
