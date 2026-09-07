export default defineNuxtConfig({
  modules: ['@ganttkit/nuxt'],

  // Everything the module needs, in one place. `renderer` also decides which
  // stylesheet is injected and which renderer package reaches the bundle.
  ganttkit: {
    renderer: 'svg',
    defaults: {
      viewMode: 'Week',
      dayWidth: 36,
      rowHeight: 30,
      highlightToday: true,
    },
  },

  // On to prove the point: the chart is painted by a DOM renderer, so the
  // server sends an empty sized container and the engine takes over on the
  // client. Nothing shifts, and no `<ClientOnly>` is needed.
  ssr: true,

  compatibilityDate: '2026-09-07',
})
