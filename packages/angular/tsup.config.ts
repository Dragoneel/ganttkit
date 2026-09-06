import { copyFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

/**
 * Second half of the build: `ngc` emits partially-compiled ES modules into
 * `.ngc/` (and the declarations straight into `dist/`), and this flattens them
 * into the single `fesm2022` bundle the Angular Package Format prescribes.
 *
 * The bundle keeps its `ɵɵngDeclare*` calls: the consuming app's build runs the
 * Angular linker over them, which is what makes the package work across Angular
 * versions instead of being pinned to the one it was compiled with.
 */
export default defineConfig({
  entry: { 'ganttkit-angular': '.ngc/index.js' },
  outDir: 'dist/fesm2022',
  outExtension: () => ({ js: '.mjs' }),
  format: ['esm'],
  dts: false,
  clean: false,
  sourcemap: true,
  target: 'es2022',
  external: ['@angular/core', '@ganttkit/core', '@ganttkit/html'],
  esbuildOptions: (options) => {
    // Keep the `ɵ` characters literal. Angular's build decides whether a file
    // needs linking by looking for the raw `ɵɵngDeclare` prefix in its source,
    // and esbuild's default ASCII charset escapes it to `\u0275`, which hides
    // every declaration in this bundle from the linker.
    options.charset = 'utf8'
  },
  onSuccess: async () => {
    // Ship the stylesheet re-export alongside the bundle.
    copyFileSync('src/styles.css', 'dist/styles.css')
  },
})
