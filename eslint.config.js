import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['.cache/**', '.source-package/**', '.wrangler/**', 'dist/**', 'node_modules/**', 'playwright-report/**', 'public/releases/**', 'public/x2t/**', 'test-results/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.node,
      sourceType: 'module',
    },
  },
]
