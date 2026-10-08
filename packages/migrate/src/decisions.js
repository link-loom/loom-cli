import fs from 'node:fs';

import { ERROR_CODES, LoomError, validateOptions } from '@link-loom/devkit';

/** The JSON Schema of migration.decisions.json: what `migrate apply` reads (`link-loom schema migration`). */
export const DECISIONS_SCHEMA = JSON.parse(
  fs.readFileSync(new URL('./decisions.schema.json', import.meta.url), 'utf8'),
);

/**
 * Checks finished decisions before anything is built: their shape against the schema, and that two texts sharing a
 * key say the same words (a dictionary key holds one text).
 */
export const validateDecisions = (decisions) => {
  validateOptions(DECISIONS_SCHEMA, decisions);
  const byKey = new Map();
  const clashes = [];
  for (const text of decisions.texts || []) {
    if (!text.key || !text.en || !text.es) continue;
    const seen = byKey.get(text.key);
    if (seen && (seen.en !== text.en || seen.es !== text.es)) {
      clashes.push({
        field: 'texts',
        message: `"${text.key}" holds "${seen.en}" and "${text.en}": give one another key`,
      });
    }

    if (!seen) byKey.set(text.key, text);
  }

  if (clashes.length) {
    throw new LoomError(ERROR_CODES.validation, 'Two texts share a key with different words', { problems: clashes });
  }

  return decisions;
};
