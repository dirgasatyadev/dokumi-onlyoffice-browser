import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        parentHarness: resolve(import.meta.dirname, 'tests/browser/parent.html'),
      },
    },
    target: 'es2022',
  },
  worker: {
    format: 'iife',
  },
})
