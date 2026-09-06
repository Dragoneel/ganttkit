import { fileURLToPath } from 'node:url'
import angular from '@analogjs/vite-plugin-angular'
import { defineConfig } from 'vite'

export default defineConfig({
  // The plugin defaults to `tsconfig.app.json`; this example keeps one tsconfig.
  plugins: [angular({ tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)) })],
})
