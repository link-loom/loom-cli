import {
  colorTokensRule,
  copyRule,
  gridRule,
  layersRule,
  noSelectRule,
  recordRule,
  semanticRule,
  shellRule,
} from './components.js';
import { admintoRule, secretsRule } from './hygiene.js';
import { i18nParityRule } from './i18n.js';
import { orphanPagesRule, pageLoadedRule } from './pages.js';
import { structureRule } from './structure.js';
import { testsRule } from './tests.js';

/** The rules `link-loom check` runs on a webapp, in the order they are reported. */
export const RULES = Object.freeze([
  structureRule,
  pageLoadedRule,
  orphanPagesRule,
  recordRule,
  noSelectRule,
  gridRule,
  shellRule,
  semanticRule,
  copyRule,
  i18nParityRule,
  colorTokensRule,
  layersRule,
  admintoRule,
  secretsRule,
  testsRule,
]);
