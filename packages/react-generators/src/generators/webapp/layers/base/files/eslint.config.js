import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage", ".claude", ".agent"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended, reactHooks.configs["recommended-latest"], reactRefresh.configs.vite, jsxA11y.flatConfigs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      // A Command Center companion (*.sommatic.jsx) exports its page's metadata beside the component.
      "react-refresh/only-export-components": ["error", { allowExportNames: ["PAGE_METADATA"] }],
    },
  },
  {
    files: ["*.config.js", "tools/**/*.js", "tests/support/*.cjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Tests are never hot-reloaded, so their helpers may export what they need.
    files: ["tests/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    rules: { "react-refresh/only-export-components": "off" },
  },
]);
