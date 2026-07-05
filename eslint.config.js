import js from '@eslint/js'

export default [
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/.next',
      '**/build',
      '**/.nuxt',
      '**/coverage',
      '**/*.d.ts',
      '**/packages/*/src/**', // TypeScript source files need typescript-eslint parser
      '**/packages/*/examples/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
  },
]
