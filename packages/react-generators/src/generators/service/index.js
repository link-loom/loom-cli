import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { camelCase, entityNames, sentenceCase } from '../entity/naming.js';
import { renderInto, requireWebapp, within } from '../shared/project.js';

const SERVICE_FILES_DIR = fileURLToPath(new URL('../shared/service-files/', import.meta.url));

/** `add service`: a service on BaseApi for one backend entity, and its test. */
export default async function serviceGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'service');
  const files = within(tree, context.directory);
  const names = entityNames(options);
  const file = `src/services/${names.domain}/${names.entity}/${names.serviceFile}.js`;
  if (files.exists(file)) {
    throw new LoomError(ERROR_CODES.targetExists, `The service already exists: ${file}`, { path: file });
  }

  renderInto(files, [SERVICE_FILES_DIR], {
    ...names,
    endpoint: options.endpoint || `/${names.domain}/${names.entity}`,
    scoped: options.scope === 'organization',
    customActions: options.calls.map((id) => ({ id, kind: 'call', key: camelCase(id), labelEn: sentenceCase(id) })),
    json: (value) => JSON.stringify(value),
  });
  return { warnings: [], project: { service: { file, class: names.serviceClass } }, next: ['npm run verify'] };
}
