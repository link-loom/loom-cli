import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { camelCase, pascalCase } from '../entity/naming.js';
import { addCopy, addIcon, addNavigationEntry, renderInto, requireWebapp, within } from '../shared/project.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const FILES_DIR = here('./files/');
const COMMAND_CENTER_FILES_DIR = here('./files-command-center/');

const EMPTY_COPY = Object.freeze({
  en: { emptyTitle: 'Nothing here yet', emptyDescription: 'What this page shows will appear here.' },
  es: { emptyTitle: 'Aún no hay nada aquí', emptyDescription: 'Lo que muestra esta página aparecerá aquí.' },
});

/**
 * `add page`: a page of a domain, routed under the app's base route, built on the kit (PageShell, PageHeader) with
 * an empty state to replace, its copy, its test and, with the Command Center, its companion.
 */
export default async function pageGenerator(tree, options, context = {}) {
  const manifest = context.project;
  requireWebapp(manifest, 'page');
  const files = within(tree, context.directory);
  const Prefix = `${pascalCase(options.domain)}${pascalCase(options.name)}`;
  const componentDir = `src/components/pages/${options.domain}/${options.name}`;
  if (files.exists(componentDir) || files.exists(`src/pages/${options.domain}/${Prefix}.page.jsx`)) {
    throw new LoomError(ERROR_CODES.targetExists, `The page already exists: ${Prefix}`, { path: componentDir });
  }

  const copyPath = `${camelCase(options.domain)}.${camelCase(options.name)}`;
  const routePath = options.path || `${options.domain}/${options.name}`;
  const data = {
    ...options,
    Prefix,
    copyPath,
    routePath,
    advanced: options.section === 'advanced',
    basePath: manifest.basePath,
    appName: manifest.name,
    json: (value) => JSON.stringify(value),
  };
  const commandCenter = (manifest.layers || []).includes('command-center');
  renderInto(files, [FILES_DIR, ...(commandCenter ? [COMMAND_CENTER_FILES_DIR] : [])], data);

  const copyOf = (locale, title, description) => ({
    [camelCase(options.domain)]: {
      [camelCase(options.name)]: { title, ...(description ? { description } : {}), ...EMPTY_COPY[locale] },
    },
  });
  addCopy(
    files,
    {
      en: copyOf('en', options.titleEn, options.descriptionEn),
      es: copyOf('es', options.titleEs || options.titleEn, options.descriptionEs ?? options.descriptionEn),
    },
    { owned: [copyPath] },
  );
  addIcon(files, options.icon);
  if (options.navigation && options.section === 'app') {
    addNavigationEntry(files, {
      id: `${options.domain}-${options.name}`,
      labelKey: `${copyPath}.title`,
      icon: options.icon,
      to: `/${routePath}`,
    });
  }

  const pendingSpanish = [
    !options.titleEs && 'titleEs',
    options.descriptionEn && options.descriptionEs === undefined && 'descriptionEs',
  ];
  return {
    warnings: pendingSpanish.some(Boolean)
      ? [`Spanish copy fell back to English for: ${pendingSpanish.filter(Boolean).join(', ')}`]
      : [],
    project: {
      page: { file: `src/pages/${options.domain}/${Prefix}.page.jsx`, path: `${manifest.basePath}/${routePath}` },
    },
    next: ['npm run verify'],
  };
}
