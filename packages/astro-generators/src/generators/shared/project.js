import path from 'node:path';

import { ERROR_CODES, LoomError, addMissingProperties, setProperty } from '@link-loom/devkit';

/** The files of a landing the `add` generators edit. */
export const LANDING_FILES = Object.freeze({
  manifest: 'loom.json',
  nav: 'src/data/nav.ts',
  pages: 'src/data/pages.ts',
  copy: (locale) => `src/data/copy/${locale}.ts`,
  view: (page) => `src/views/${page}`,
  sections: (page) => `src/views/${page}/sections.ts`,
});

export const LOCALES = Object.freeze(['en', 'es']);

/** The tree seen from a project folder inside it: how `create landing` adds the site's first pieces. */
export const within = (tree, directory) =>
  directory
    ? {
        root: path.join(tree.root, directory),
        exists: (file) => tree.exists(`${directory}/${file}`),
        read: (file, encoding) => tree.read(`${directory}/${file}`, encoding),
        create: (file, content) => tree.create(`${directory}/${file}`, content),
        overwrite: (file, content) => tree.overwrite(`${directory}/${file}`, content),
        delete: (file) => tree.delete(`${directory}/${file}`),
      }
    : tree;

/** Refuses to run outside a landing project. */
export const requireLanding = (manifest, generator) => {
  if (manifest?.type !== 'landing') {
    throw new LoomError(ERROR_CODES.usage, `\`add ${generator}\` runs inside a landing project`);
  }
};

export const readRequired = (tree, file, purpose = 'the piece cannot be registered') => {
  const content = tree.read(file, 'utf8');
  if (content === null || content === undefined) {
    throw new LoomError(ERROR_CODES.editShape, `${file} is missing; ${purpose}`, { path: file });
  }

  return String(content);
};

/** `{ en, es }` copy values nested under a dotted key: copyTreeAt('home.hero', { en: x, es: y }) */
export const copyTreeAt = (key, values) =>
  Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      key
        .split('.')
        .reverse()
        .reduce((child, segment) => ({ [segment]: child }), values[locale]),
    ]),
  );

const valueAt = (tree, dotted) => dotted.split('.').reduce((value, key) => value?.[key], tree);

/**
 * Adds copy to both dictionaries (`trees` is `{ en, es }`). A key under one of the `owned` prefixes that already
 * exists is the piece already being there: a conflict, unless `replace` rewrites it.
 */
export const addCopy = (tree, trees, { owned = [], replace = false } = {}) => {
  for (const locale of LOCALES) {
    const file = LANDING_FILES.copy(locale);
    const { source, conflicts } = addMissingProperties(readRequired(tree, file), {
      name: 'COPY',
      file,
      tree: trees[locale],
    });
    const clash = conflicts.find((key) => owned.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
    if (clash && !replace) {
      throw new LoomError(ERROR_CODES.targetExists, `${file} already has the copy key ${clash}`, {
        path: file,
        key: clash,
        next: ['Pass --replace --yes to rewrite it'],
      });
    }

    const rewritten = clash
      ? owned.reduce(
          (current, key) =>
            valueAt(trees[locale], key) === undefined
              ? current
              : setProperty(current, { name: 'COPY', path: key.split('.'), value: valueAt(trees[locale], key), file }),
          source,
        )
      : source;
    tree.overwrite(file, rewritten);
  }
};

/** Records something in loom.json (an entry of a list, without duplicates). */
export const recordInManifest = (tree, manifest, key, entry, idOf = (item) => item.id) => {
  const list = (manifest[key] || []).filter((item) => idOf(item) !== idOf(entry));
  const next = { ...manifest, [key]: [...list, entry] };
  tree.overwrite(LANDING_FILES.manifest, `${JSON.stringify(next, null, 2)}\n`);
  return next;
};
