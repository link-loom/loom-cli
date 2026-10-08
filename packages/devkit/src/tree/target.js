import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError } from '../errors.js';

/**
 * The folder a `create` writes into, relative to the tree root: `directory`, or the slug. "." is the working folder
 * itself, which must hold nothing but dotfiles; any other folder must not exist yet.
 */
export const resolveTargetDirectory = (tree, { directory, slug }) => {
  const here = directory === '.' || directory === './';
  if (here) {
    // A folder a dry run has not created yet holds nothing.
    const entries = fs.existsSync(tree.root) ? fs.readdirSync(tree.root) : [];
    const taken = entries.filter((entry) => !entry.startsWith('.'));
    if (taken.length) {
      throw new LoomError(
        ERROR_CODES.targetExists,
        `The working folder is not empty: ${taken.slice(0, 5).join(', ')}`,
        {
          path: '.',
          next: ['Create it in a new folder (leave --directory out) or empty this one'],
        },
      );
    }

    return '';
  }

  const target = directory || slug;
  if (tree.exists(target)) {
    throw new LoomError(ERROR_CODES.targetExists, `The target folder already exists: ${target}`, { path: target });
  }

  return target;
};

/** A file the person named in an option (their logo), read from `root`; undefined when the option is empty. */
export const readInputFile = (root, file, field) => {
  if (!file) {
    return undefined;
  }

  const fullPath = path.resolve(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new LoomError(ERROR_CODES.validation, `The ${field} file does not exist: ${file}`, {
      problems: [{ field, message: 'file not found' }],
    });
  }

  return fs.readFileSync(fullPath);
};
