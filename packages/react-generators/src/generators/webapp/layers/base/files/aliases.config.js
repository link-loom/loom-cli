import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** The import aliases, read by both Vite and Jest so they never drift apart. */
export const ALIASES = Object.freeze({
  "@components": "src/components",
  "@pages": "src/pages",
  "@layouts": "src/layouts",
  "@routes": "src/routes",
  "@services": "src/services",
  "@hooks": "src/hooks",
  "@constants": "src/constants",
  "@i18n": "src/i18n",
  "@utils": "src/utils",
  "@app-config": "src/app.config.js",
});

export const absoluteAliases = () =>
  Object.fromEntries(Object.entries(ALIASES).map(([alias, target]) => [alias, path.resolve(root, target)]));
