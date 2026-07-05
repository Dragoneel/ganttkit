import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@ganttkit/core': resolve(__dirname, './packages/core/src'),
      '@ganttkit/svg': resolve(__dirname, './packages/svg/src'),
      '@ganttkit/html': resolve(__dirname, './packages/html/src'),
      '@ganttkit/canvas': resolve(__dirname, './packages/canvas/src'),
      '@ganttkit/plugin-baseline': resolve(__dirname, './packages/plugin-baseline/src'),
      '@ganttkit/plugin-columns': resolve(__dirname, './packages/plugin-columns/src'),
      '@ganttkit/plugin-dependencies': resolve(__dirname, './packages/plugin-dependencies/src'),
      '@ganttkit/plugin-filter': resolve(__dirname, './packages/plugin-filter/src'),
      '@ganttkit/plugin-i18n': resolve(__dirname, './packages/plugin-i18n/src'),
      '@ganttkit/plugin-markers': resolve(__dirname, './packages/plugin-markers/src'),
    },
  },
})
