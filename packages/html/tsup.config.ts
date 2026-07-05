import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: ['@ganttkit/core'],
  onSuccess: async () => {
    // Ship the stylesheet alongside the bundle.
    copyFileSync('src/styles.css', 'dist/styles.css')
  },
})
