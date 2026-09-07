import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * The root config cannot cover this package: its runtime imports
 * `#ganttkit-options`, a module that only exists once Nuxt has generated it,
 * so the tests point that alias at a fixture instead.
 *
 * The workspace aliases below are the ones the root config sets, repeated
 * because a package-level config replaces it rather than extending it.
 */
export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '#ganttkit-options': resolve(__dirname, './test/fixtures/ganttkit-options.ts'),
      '@ganttkit/core': resolve(__dirname, '../core/src'),
      '@ganttkit/html': resolve(__dirname, '../html/src'),
      '@ganttkit/svg': resolve(__dirname, '../svg/src'),
      '@ganttkit/canvas': resolve(__dirname, '../canvas/src'),
      '@ganttkit/vue': resolve(__dirname, '../vue/src'),
    },
  },
})
