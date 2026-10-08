import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError, appendToArray, renderTemplate } from '@link-loom/devkit';

import sectionGenerator from '../section/index.js';
import { LANDING_FILES, LOCALES, addCopy, readRequired, requireLanding, within } from '../shared/project.js';
import { camelCase, pascalCase, quote } from '../shared/source.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const template = (file) => fs.readFileSync(here(`./files/${file}`), 'utf8');

const navEntry = ({ id, label, path }) =>
  `{ id: ${quote(id)}, label: { en: ${quote(label.en)}, es: ${quote(label.es)} }, path: ${quote(path)} }`;

/** Registers the page where `--nav` says: the header menu, a footer column, or nowhere. */
const linkPage = (files, nav, entry, before) => {
  if (nav === 'none') {
    return;
  }

  const source = readRequired(files, LANDING_FILES.nav);
  const column = nav.startsWith('footer:') ? nav.slice('footer:'.length) : null;
  files.overwrite(
    LANDING_FILES.nav,
    column
      ? appendToArray(source, {
          name: 'FOOTER_COLUMNS',
          path: [column, 'links'],
          element: navEntry(entry),
          id: entry.id,
          file: LANDING_FILES.nav,
        })
      : appendToArray(source, {
          name: 'HEADER_NAV',
          element: navEntry(entry),
          id: entry.id,
          before,
          file: LANDING_FILES.nav,
        }),
  );
};

/**
 * `add page`: a page in both languages. The two route files render one view; the view starts with a page hero and
 * ends with a quiet call to action, and lists its sections in sections.ts.
 */
export default async function pageGenerator(tree, options, context = {}) {
  requireLanding(context.project, 'page');
  const files = within(tree, context.directory);
  const id = options.id || options.path.slice(1).replace(/\//g, '-');
  const key = camelCase(id);
  const name = pascalCase(id);
  const viewDir = LANDING_FILES.view(id);
  const routes = Object.fromEntries(LOCALES.map((locale) => [locale, `src/pages/${locale}${options.path}.astro`]));

  const taken = [viewDir, ...Object.values(routes)].find((file) => files.exists(file));
  if (taken) {
    throw new LoomError(ERROR_CODES.targetExists, `${taken} already exists`, { path: taken });
  }

  const title = { en: options.titleEn, es: options.titleEs || options.titleEn };
  const description = {
    en: options.descriptionEn || context.project.site?.description.en || '',
    es: options.descriptionEs || options.descriptionEn || context.project.site?.description.es || '',
  };
  const data = { id, key, name, path: options.path, title: title.en, quote };

  files.create(`${viewDir}/${name}Page.astro`, renderTemplate(template('View.astro.ejs'), data));
  files.create(LANDING_FILES.sections(id), renderTemplate(template('sections.ts.ejs'), data));
  for (const locale of LOCALES) {
    files.create(routes[locale], renderTemplate(template('route.astro.ejs'), { ...data, locale }));
  }

  addCopy(
    files,
    {
      en: { [key]: { meta: { title: title.en, description: description.en } } },
      es: { [key]: { meta: { title: title.es, description: description.es } } },
    },
    { owned: [key] },
  );

  files.overwrite(
    LANDING_FILES.pages,
    appendToArray(readRequired(files, LANDING_FILES.pages), {
      name: 'PAGES',
      element: `{ id: ${quote(id)}, path: ${quote(options.path)}, title: { en: ${quote(title.en)}, es: ${quote(title.es)} } }`,
      id,
      file: LANDING_FILES.pages,
    }),
  );
  linkPage(files, options.nav, { id, label: title, path: options.path }, options.navBefore);

  await sectionGenerator(
    tree,
    {
      page: id,
      kind: 'page-hero',
      id: 'hero',
      eyebrowEn: title.en,
      eyebrowEs: title.es,
      titleEn: options.headlineEn || title.en,
      titleEs: options.headlineEs || options.headlineEn || title.es,
      deckEn: description.en,
      deckEs: description.es,
    },
    context,
  );
  await sectionGenerator(tree, { page: id, kind: 'page-cta', id: 'page-cta' }, context);

  return {
    warnings: options.titleEs ? [] : ['Spanish copy fell back to English; pass --title-es and --description-es'],
    project: { page: { id, path: options.path, view: viewDir, routes: Object.values(routes) } },
    next: [`npx link-loom add section --page ${id} --kind cards --id <id>`],
  };
}
