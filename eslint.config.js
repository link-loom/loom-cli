import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/coverage/**', '**/tests/fixtures/**', '**/templates/**', '**/files/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['packages/*/tests/**/*.js', 'scripts/tests/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
];
