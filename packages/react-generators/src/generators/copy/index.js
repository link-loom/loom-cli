import { addCopy, copyTreeAt, requireWebapp, within } from '../shared/project.js';

/** `add copy`: one text in both dictionaries; a key that exists is a conflict unless --replace rewrites it. */
export default async function copyGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'copy');
  addCopy(within(tree, context.directory), copyTreeAt(options.key, { en: options.en, es: options.es }), {
    owned: [options.key],
    replace: options.replace,
  });
  return { warnings: [], project: { copy: { key: options.key } }, next: [] };
}
