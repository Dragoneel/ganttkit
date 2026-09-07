# @ganttkit/nuxt

## 0.2.0

### Minor Changes

- 0e7ded2: Add `@ganttkit/nuxt`, a Nuxt module over the Vue binding.

  `<GanttChart>` and `useGantt()` are auto-imported, the renderer's stylesheet is
  added to `nuxt.options.css`, and both the base renderer and the app-wide chart
  defaults are set once under the `ganttkit` key in `nuxt.config`:

  ```ts
  export default defineNuxtConfig({
    modules: ["@ganttkit/nuxt"],
    ganttkit: {
      renderer: "html",
      defaults: { viewMode: "Week", dayWidth: 36 },
    },
  });
  ```

  `renderer` is a name rather than a factory, which lets the module resolve it to
  a static import at build time, so the two renderers an app does not choose are
  dropped from both the client and the server bundle. Every prop, event and
  feature plugin behaves as it does in `@ganttkit/vue`, and SSR needs no
  `<ClientOnly>`: the server renders the sized container and the engine paints
  into it after hydration.
