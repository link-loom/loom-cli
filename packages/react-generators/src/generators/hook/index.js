import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { renderInto, requireWebapp, within } from '../shared/project.js';

const FILES_DIR = fileURLToPath(new URL('./files/', import.meta.url));

/** `add hook`: a hook and its test. */
export default async function hookGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'hook');
  const files = within(tree, context.directory);
  const file = `src/hooks/${options.name}.hook.js`;
  if (files.exists(file)) {
    throw new LoomError(ERROR_CODES.targetExists, `The hook already exists: ${file}`, { path: file });
  }

  renderInto(files, [FILES_DIR], options);
  return { warnings: [], project: { hook: { file } }, next: ['npm run verify'] };
}
