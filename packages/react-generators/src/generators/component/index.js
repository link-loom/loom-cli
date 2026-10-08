import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { renderInto, requireWebapp, within } from '../shared/project.js';

const FILES_DIR = fileURLToPath(new URL('./files/', import.meta.url));

const kebabOf = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `add component`: a component (shared or of a domain) with its test. */
export default async function componentGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'component');
  const files = within(tree, context.directory);
  const folder = options.domain
    ? `pages/${options.domain}/${kebabOf(options.name)}`
    : `shared/${kebabOf(options.name)}`;
  const file = `src/components/${folder}/${options.name}.component.jsx`;
  if (files.exists(file)) {
    throw new LoomError(ERROR_CODES.targetExists, `The component already exists: ${file}`, { path: file });
  }

  renderInto(files, [FILES_DIR], { ...options, folder });
  return { warnings: [], project: { component: { file } }, next: ['npm run verify'] };
}
