import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Data fetching on mount has no framework-level replacement without a
      // router/framework data layer, so loading in an effect is intentional.
      'react-hooks/set-state-in-effect': 'warn',
      // Context hooks intentionally live next to their provider; they export no
      // components, so fast refresh is unaffected.
      'react-refresh/only-export-components': ['error', { allowExportNames: ['useI18n', 'useAuth'] }],
    },
  },
])
