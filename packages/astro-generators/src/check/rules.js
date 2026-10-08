import { CHECK_SEVERITIES, walkAst } from '@link-loom/devkit';

import { lineAt, splitAstro, withoutExpressions } from './astro-source.js';

const LOCALES = Object.freeze(['en', 'es']);
// The tokens themselves, and the browser's theme colour (a meta tag needs the literal).
const COLOR_SOURCES = Object.freeze(['src/styles/_tokens.scss', 'src/data/site.ts']);
const COLOR = /(?<![\w&-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const isAstro = (file) => file.endsWith('.astro');
const inEditor = (file) => file.startsWith('src/editor/') || file.startsWith('integrations/');

// --- structure ---------------------------------------------------------------------------------------------------

const PLACES = Object.freeze([
  { pattern: /^src\/pages\/(en|es)\/.+\.(astro|ts)$/ },
  { pattern: /^src\/pages\/(index|404)\.astro$/ },
  { pattern: /^src\/pages\/[a-z0-9.-]+\.txt\.ts$/ },
  { pattern: /^src\/components\/(layout|page|seo|ui|blog|search)\/[A-Z][A-Za-z]+\.(astro|tsx)$/ },
  { pattern: /^src\/views\/[a-z][a-z0-9-]*\/[A-Z][A-Za-z]+Page\.astro$/ },
  { pattern: /^src\/views\/[a-z][a-z0-9-]*\/sections\.ts$/ },
  { pattern: /^src\/views\/[a-z][a-z0-9-]*\/sections\/[A-Z][A-Za-z0-9]+\.astro$/ },
  { pattern: /^src\/views\/types\.ts$/ },
  { pattern: /^src\/layouts\/[A-Z][A-Za-z]+Layout\.astro$/ },
  { pattern: /^src\/data\/.+\.ts$/ },
  { pattern: /^src\/utils\/[a-z][a-z0-9-]*\.ts$/ },
  { pattern: /^src\/scripts\/[a-z][a-z0-9-]*\.ts$/ },
  { pattern: /^src\/styles\/.+\.scss$/ },
  { pattern: /^src\/content\/(config\.ts|blog\/(\.gitkeep|[a-z0-9][a-z0-9-]*(\.es)?\.md))$/ },
  { pattern: /^src\/editor\// },
  // The site's own SVG icons, for astro-icon (`<Icon name="local-name" />`).
  { pattern: /^src\/icons\/([a-z0-9-]+\.svg|\.gitkeep)$/ },
]);

export const structureRule = {
  id: 'structure',
  severity: CHECK_SEVERITIES.error,
  summary: 'Each file sits where the conventions put it (pages, views and sections, components, data, utils)',
  run: (project) =>
    project.targets
      .filter((file) => file.startsWith('src/') && !PLACES.some((place) => place.pattern.test(file)))
      .map((file) => ({
        file,
        message:
          'Out of place: a page goes in src/pages/<en|es>/, what it shows in src/views/<page>/, shared blocks in src/components/<area>/',
      })),
};

// --- pages ---------------------------------------------------------------------------------------------------------

const localizedPages = (project, locale) =>
  project.files
    .filter((file) => file.startsWith(`src/pages/${locale}/`))
    .map((file) => file.slice(`src/pages/${locale}/`.length));

export const mirroredPagesRule = {
  id: 'mirrored-pages',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every page exists in English and in Spanish',
  run: (project) =>
    LOCALES.flatMap((locale) => {
      const other = LOCALES.find((candidate) => candidate !== locale);
      const theirs = new Set(localizedPages(project, other));
      return localizedPages(project, locale)
        .filter((page) => !theirs.has(page))
        .map((page) => ({
          file: `src/pages/${locale}/${page}`,
          message: `Has no ${other} twin (src/pages/${other}/${page}): create pages with \`link-loom add page\``,
        }));
    }),
};

const pageExists = (project, path) => {
  const base = `src/pages/en${path === '/' ? '' : path}`;
  return project.exists(`${base}.astro`) || project.exists(`${base}/index.astro`);
};

const PATH_VALUE = /path:\s*'([^']+)'/g;

export const linksRule = {
  id: 'links',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every path of the navigation and the page list has a page',
  run: (project) =>
    ['src/data/nav.ts', 'src/data/pages.ts'].flatMap((file) => {
      const source = project.read(file) || '';
      return [...source.matchAll(PATH_VALUE)]
        .filter((match) => !pageExists(project, match[1]))
        .map((match) => ({ file, line: lineAt(source, match.index), message: `No page serves ${match[1]}` }));
    }),
};

// --- sections ----------------------------------------------------------------------------------------------------

export const sectionsRule = {
  id: 'sections',
  severity: CHECK_SEVERITIES.error,
  summary: "Every section component is listed in its page's sections.ts, and every listed one exists",
  run: (project) =>
    project.files
      .filter((file) => /^src\/views\/[^/]+\/sections\.ts$/.test(file))
      .flatMap((file) => {
        const dir = file.slice(0, -'sections.ts'.length);
        const source = project.read(file) || '';
        const imported = [...source.matchAll(/from '\.\/sections\/([A-Za-z0-9]+)\.astro'/g)].map((match) => match[1]);
        const present = project.files
          .filter((other) => other.startsWith(`${dir}sections/`) && other.endsWith('.astro'))
          .map((other) => other.slice(`${dir}sections/`.length, -'.astro'.length));
        return [
          ...present
            .filter((name) => !imported.includes(name))
            .map((name) => ({
              file: `${dir}sections/${name}.astro`,
              message: `Not listed in ${file}: the page never shows it`,
            })),
          ...imported
            .filter((name) => !present.includes(name))
            .map((name) => ({ file, message: `Imports sections/${name}.astro, which does not exist` })),
        ];
      }),
};

// --- copy ----------------------------------------------------------------------------------------------------------

const keyOf = (property) => property.key?.name ?? property.key?.value;

/** The key paths of `export const COPY = { … }`. Arrays count as one key. */
const copyKeys = (ast) => {
  let root = null;
  walkAst(ast, (node) => {
    if (!root && node.type === 'VariableDeclarator' && node.id?.name === 'COPY') {
      root = node.init?.type === 'TSAsExpression' ? node.init.expression : node.init;
    }
  });

  const paths = [];
  const visit = (object, prefix) =>
    object.properties.forEach((property) => {
      const path = prefix ? `${prefix}.${keyOf(property)}` : keyOf(property);
      if (property.value?.type === 'ObjectExpression') {
        visit(property.value, path);
        return;
      }

      paths.push(path);
    });
  if (root?.type === 'ObjectExpression') {
    visit(root, '');
  }

  return paths;
};

export const copyParityRule = {
  id: 'copy-parity',
  severity: CHECK_SEVERITIES.error,
  summary: 'en.ts and es.ts have exactly the same keys',
  run: (project) => {
    const keys = Object.fromEntries(
      LOCALES.map((locale) => [locale, copyKeys(project.ast(`src/data/copy/${locale}.ts`))]),
    );
    return LOCALES.flatMap((locale) => {
      const other = LOCALES.find((candidate) => candidate !== locale);
      return keys[other]
        .filter((key) => !keys[locale].includes(key))
        .map((key) => ({ file: `src/data/copy/${locale}.ts`, message: `Missing "${key}", which ${other}.ts has` }));
    });
  },
};

const TEXT_ATTRIBUTES = /\b(alt|title|aria-label|placeholder)="([^"]*[A-Za-zÀ-ÿ][^"]*)"/g;
const TEXT_NODE = />([^<>]*[A-Za-zÀ-ÿ][^<>]*)</g;

export const copyRule = {
  id: 'copy',
  severity: CHECK_SEVERITIES.error,
  summary: 'No visible text written in a template: it comes from src/data/copy/{en,es}.ts',
  run: (project) =>
    project.targets
      .filter((file) => isAstro(file) && file.startsWith('src/') && !inEditor(file))
      .flatMap((file) => {
        const source = project.read(file) || '';
        const { template } = splitAstro(source);
        const offset = source.indexOf(template.slice(0, 40));
        const markup = withoutExpressions(template);
        const found = [
          ...[...markup.matchAll(TEXT_NODE)].map((match) => ({ index: match.index, text: match[1].trim() })),
          ...[...markup.matchAll(TEXT_ATTRIBUTES)].map((match) => ({
            index: match.index,
            text: `${match[1]}="${match[2]}"`,
          })),
        ];
        return found.map(({ index, text }) => ({
          file,
          line: offset >= 0 ? lineAt(source, offset + index) : undefined,
          message: `Text "${text.slice(0, 40)}" in the template: add it to the copy (link-loom add copy) and read it from there`,
        }));
      }),
};

// --- styles --------------------------------------------------------------------------------------------------------

const colorsIn = (text) => [...text.matchAll(COLOR)].map((match) => ({ index: match.index, color: match[0] }));

export const colorTokensRule = {
  id: 'color-tokens',
  severity: CHECK_SEVERITIES.error,
  summary: 'Colours are tokens of src/styles/_tokens.scss (var(--site-…)), never a literal',
  run: (project) =>
    project.targets
      .filter((file) => !COLOR_SOURCES.includes(file) && /\.(astro|scss|tsx|ts)$/.test(file) && file.startsWith('src/'))
      .flatMap((file) => {
        const source = project.read(file) || '';
        if (file.endsWith('.scss')) {
          return colorsIn(source).map(({ index, color }) => ({
            file,
            line: lineAt(source, index),
            message: `Colour ${color}: use a --site-* token`,
          }));
        }

        if (isAstro(file)) {
          const { styles, template } = splitAstro(source);
          const inline = [...template.matchAll(/style="([^"]*)"/g)].map((match) => match[1]);
          return [...styles, ...inline].flatMap((block) =>
            colorsIn(block).map(({ color }) => ({ file, message: `Colour ${color}: use a --site-* token` })),
          );
        }

        const problems = [];
        walkAst(project.ast(file), (node) => {
          const text =
            node.type === 'StringLiteral' ? node.value : node.type === 'TemplateElement' ? node.value.raw : '';
          colorsIn(text).forEach(({ color }) =>
            problems.push({ file, line: node.loc?.start.line, message: `Colour ${color}: use a --site-* token` }),
          );
        });
        return problems;
      }),
};

// --- accessibility -------------------------------------------------------------------------------------------------

export const imagesRule = {
  id: 'images',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every <img> says what it shows (alt, empty only when decorative)',
  run: (project) =>
    project.targets
      .filter((file) => isAstro(file) && file.startsWith('src/'))
      .flatMap((file) => {
        const source = project.read(file) || '';
        return [...source.matchAll(/<img\b[^>]*>/g)]
          .filter((match) => !/\balt=/.test(match[0]))
          .map((match) => ({ file, line: lineAt(source, match.index), message: 'An <img> without alt' }));
      }),
};
