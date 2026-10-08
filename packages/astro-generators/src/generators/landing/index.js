import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ERROR_CODES,
  LoomError,
  OG_WIDTH,
  brandAssets,
  composePackageJson,
  ogSvg,
  readInputFile,
  renderDirectory,
  resolveBrand,
  resolveTargetDirectory,
  sha256,
  skillFiles,
  stringifyJson,
  svgToJpeg,
} from '@link-loom/devkit';

import sectionGenerator from '../section/index.js';
import { copyModule, fillTokens, mergeCopy, quote, slugify } from '../shared/source.js';
import { LANDING_FILES } from '../shared/project.js';
import { fontsHref, landingPalette } from './compose/palette.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const LAYERS_DIR = here('./layers/');
const SKILL_NAME = 'loom-landing';
const SKILL_DIR = here(`../../../skills/${SKILL_NAME}/`);
const AGENT_SKILL_DIRS = Object.freeze([`.claude/skills/${SKILL_NAME}`, `.agent/skills/${SKILL_NAME}`]);
const STACK = readJson(here('../../stack.json'));
const COLLECTION_VERSION = readJson(here('../../../package.json')).version;
const LOCALES = Object.freeze(['en', 'es']);

export const LAYER_IDS = Object.freeze({ base: 'base', blog: 'blog', search: 'search', editor: 'editor' });

const activeLayerIds = (options) =>
  [
    LAYER_IDS.base,
    options.blog && LAYER_IDS.blog,
    options.search && LAYER_IDS.search,
    options.editor && LAYER_IDS.editor,
  ].filter(Boolean);

const loadLayer = (id) => {
  const dir = path.join(LAYERS_DIR, id);
  const copyFile = path.join(dir, 'copy.json');
  return {
    ...readJson(path.join(dir, 'layer.json')),
    filesDir: path.join(dir, 'files'),
    copy: fs.existsSync(copyFile) ? readJson(copyFile) : { en: {}, es: {} },
  };
};

const firstSentence = (text) => (/^[^.!?]+[.!?]?/.exec(text)?.[0] || text).trim().replace(/[.!?]$/, '');

/** `id=English|Spanish` → `{ id, label: { en, es } }` */
export const parseCategories = (entries) =>
  entries.map((entry) => {
    const [id, labels] = entry.split('=');
    const [en, es] = labels.split('|');
    return { id: id.trim(), label: { en: en.trim(), es: es.trim() } };
  });

const label = (en, es) => ({ en, es });

/** The header menu, the footer columns and the page titles a new site starts with. */
const startingNavigation = (layers) => {
  const blog = { id: 'blog', label: label('Blog', 'Blog'), path: '/blog' };
  const contact = { id: 'contact', label: label('Contact', 'Contacto'), path: '/contact' };
  return {
    headerNav: [...(layers.blog ? [blog] : []), contact],
    footerColumns: [
      { id: 'company', title: label('Company', 'Compañía'), links: [...(layers.blog ? [blog] : []), contact] },
      {
        id: 'legal',
        title: label('Legal', 'Legal'),
        links: [
          { id: 'privacy', label: label('Privacy', 'Privacidad'), path: '/legal/privacy' },
          { id: 'terms', label: label('Terms', 'Términos'), path: '/legal/terms' },
        ],
      },
    ],
    pages: [
      { id: 'contact', path: '/contact', title: label('Contact', 'Contacto') },
      { id: 'privacy', path: '/legal/privacy', title: label('Privacy', 'Privacidad') },
      { id: 'terms', path: '/legal/terms', title: label('Terms', 'Términos') },
      ...(layers.blog ? [{ id: 'blog', path: '/blog', title: label('Blog', 'Blog') }] : []),
      ...(layers.search ? [{ id: 'search', path: '/search', title: label('Search', 'Buscar') }] : []),
    ],
  };
};

const loomManifest = ({ options, slug, url, layerIds, brand, palette, categories, slogan, description }) => ({
  $schema: 'https://linkloom.io/schemas/loom.json',
  type: 'landing',
  slug,
  name: options.name,
  url,
  // What the generators start new copy from: the site's own words in both languages.
  site: { slogan, description },
  defaultLocale: options.defaultLocale,
  locales: [...LOCALES],
  collection: { name: '@link-loom/astro-generators', version: COLLECTION_VERSION },
  layers: layerIds,
  features: ['images'],
  brand: { colors: brand, palette, artwork: options.logo ? 'custom' : 'generated' },
  ...(categories ? { blog: { categories } } : {}),
  skills: {
    [SKILL_NAME]: {
      version: COLLECTION_VERSION,
      files: Object.fromEntries(skillFiles(SKILL_DIR).map(({ file, content }) => [file, sha256(content)])),
    },
  },
  conventions: {
    pages: 'src/pages/<en|es>/<path>.astro renders src/views/<page>/<Name>Page.astro',
    sections: 'src/views/<page>/sections/<Name>.astro, listed in src/views/<page>/sections.ts',
    copy: 'src/data/copy/{en,es}.ts, <pageKey>.<sectionKey>.*',
    navigation: 'src/data/nav.ts (HEADER_NAV, FOOTER_COLUMNS), page titles in src/data/pages.ts',
    posts: 'src/content/blog/<slug>.md and <slug>.es.md',
  },
});

/** Share images per language: the name over the brand, with the slogan of that language. */
const shareImages = ({ name, slogan, brand }) =>
  LOCALES.map((locale) => ({
    path: `public/brand/og-default-${locale}.jpg`,
    content: svgToJpeg(ogSvg({ name, tagline: slogan[locale], brand }), OG_WIDTH),
  }));

/**
 * `create landing`: the Mi Retail landing frame (header, footer, language, SEO, sticky call to action) in English and
 * Spanish, its home hero and closing call to action, contact and legal pages, the brand files and the layers the
 * person chose. The blog starts empty: posts come from `add blog-post`. Everything goes to the virtual tree; nothing touches the disk until the plan is applied.
 */
export default async function landingGenerator(tree, options) {
  const slug = options.slug || slugify(options.name);
  if (!slug) {
    throw new LoomError(ERROR_CODES.validation, 'The name has no letters or digits to build a slug from; pass --slug', {
      problems: [{ field: 'slug', message: 'cannot be derived from the name' }],
    });
  }

  if (options.editor && !options.blog) {
    throw new LoomError(ERROR_CODES.validation, 'The blog editor edits the blog: pass --blog, or --no-editor', {
      problems: [{ field: 'editor', message: 'needs the blog layer' }],
    });
  }

  const directory = resolveTargetDirectory(tree, { directory: options.directory, slug });
  const layerIds = activeLayerIds(options);
  const layers = layerIds.map(loadLayer);
  const flags = {
    blog: layerIds.includes(LAYER_IDS.blog),
    search: layerIds.includes(LAYER_IDS.search),
    editor: layerIds.includes(LAYER_IDS.editor),
  };
  flags.react = flags.search || flags.editor;

  const domain = options.domain || `${slug}.com`;
  const url = `https://${domain}`;
  const description = { en: options.description, es: options.descriptionEs || options.description };
  const slogan = {
    en: options.slogan || firstSentence(options.description),
    es: options.sloganEs || options.slogan || firstSentence(description.es),
  };
  const fonts = { display: options.displayFont, body: options.bodyFont, mono: options.monoFont };
  const palette = landingPalette(options);
  const brand = resolveBrand({ mode: 'default', colors: { primary: palette.brand, header: palette.brand } });
  const categories = flags.blog ? parseCategories(options.blogCategories) : null;
  const contact = {
    sales: options.salesEmail || `sales@${domain}`,
    support: options.supportEmail || `support@${domain}`,
    formAction: options.contactFormAction || '',
  };

  const data = {
    name: options.name,
    slug,
    url,
    domain,
    defaultLocale: options.defaultLocale,
    port: options.port,
    legalName: options.legalName || options.name,
    description,
    slogan,
    palette,
    fonts,
    fontsHref: fontsHref(fonts),
    themeColor: palette.brand,
    social: { twitter: options.twitter || '', linkedin: options.linkedin || '' },
    contact,
    parent: { name: options.parentName || '', url: options.parentUrl || '' },
    auth: { signIn: options.signInUrl || '', signUp: options.signUpUrl || '' },
    categories: categories || [],
    layers: flags,
    ...startingNavigation(flags),
    quote,
  };

  const files = {
    root: path.join(tree.root, directory),
    exists: (file) => tree.exists(path.posix.join(directory, file)),
    read: (file, encoding) => tree.read(path.posix.join(directory, file), encoding),
    create: (file, content) => tree.create(path.posix.join(directory, file), content),
    overwrite: (file, content) => tree.overwrite(path.posix.join(directory, file), content),
  };

  for (const layer of layers) {
    for (const file of renderDirectory(layer.filesDir, data)) {
      files.create(file.path, file.content);
    }
  }

  files.create('package.json', composePackageJson({ slug, description: description.en, layers, stack: STACK }));
  files.create(
    '.env.sample',
    '# Keys for the scripts (image generation). Real values go to .env.local, never committed.\n',
  );
  files.create('.env.local', '');

  const today = new Date().toISOString().slice(0, 10);
  for (const locale of LOCALES) {
    const tokens = {
      name: options.name,
      slogan: slogan[locale],
      description: description[locale],
      supportEmail: contact.support,
      date: today,
    };
    const copy = fillTokens(mergeCopy(...layers.map((layer) => layer.copy[locale])), tokens);
    files.create(LANDING_FILES.copy(locale), copyModule(locale, copy));
  }

  const manifest = loomManifest({ options, slug, url, layerIds, brand, palette, categories, slogan, description });
  files.create(LANDING_FILES.manifest, stringifyJson(manifest));

  const context = { project: manifest, directory };
  const heroTitle = options.heroTitle
    ? { titleEn: options.heroTitle, titleEs: options.heroTitleEs || options.heroTitle }
    : {};
  await sectionGenerator(tree, { page: 'home', kind: 'hero', id: 'hero', ...heroTitle }, context);
  await sectionGenerator(tree, { page: 'home', kind: 'final-cta', id: 'final-cta' }, context);
  const artwork = {
    logo: readInputFile(tree.root, options.logo, 'logo'),
    logoDark: readInputFile(tree.root, options.logoDark, 'logoDark'),
    mark: readInputFile(tree.root, options.mark, 'mark'),
  };
  const brandFiles = brandAssets({
    name: options.name,
    description: description.en,
    brand,
    startUrl: `/${options.defaultLocale}/`,
    ...artwork,
  }).filter((file) => !file.path.endsWith('/og-default.jpg'));
  for (const file of [...brandFiles, ...shareImages({ name: options.name, slogan, brand })]) {
    files.create(file.path, file.content);
  }

  for (const skillDir of AGENT_SKILL_DIRS) {
    for (const { file, content } of skillFiles(SKILL_DIR)) {
      files.create(`${skillDir}/${file}`, content);
    }
  }

  const warnings = options.descriptionEs
    ? []
    : ['Spanish copy fell back to English for the description; pass --description-es with the Spanish sentence'];
  return {
    warnings,
    project: { directory, kind: 'landing', slug, url, layers: layerIds, brand },
    next: [...(directory ? [`cd ${directory}`] : []), 'npm run dev', 'npm run verify'],
    installIn: directory,
  };
}
