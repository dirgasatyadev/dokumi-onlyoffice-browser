import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['.cache/**', '.source-package/**', 'dist/**', 'node_modules/**', 'playwright-report/**', 'public/x2t/**', 'test-results/**'],
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
