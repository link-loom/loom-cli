import { secretsRule } from '@link-loom/devkit';

import {
  colorTokensRule,
  copyParityRule,
  copyRule,
  imagesRule,
  linksRule,
  mirroredPagesRule,
  sectionsRule,
  structureRule,
} from './rules.js';

/** The rules `link-loom check` runs on a landing, in the order they are reported. */
export const RULES = Object.freeze([
  structureRule,
  mirroredPagesRule,
  linksRule,
  sectionsRule,
  copyRule,
  copyParityRule,
  colorTokensRule,
  imagesRule,
  secretsRule,
]);
