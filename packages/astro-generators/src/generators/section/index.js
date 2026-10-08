import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError, addImport, appendToArray, renderTemplate } from '@link-loom/devkit';

import { LANDING_FILES, addCopy, readRequired, requireLanding, within } from '../shared/project.js';
import { camelCase, pascalCase, quote } from '../shared/source.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export const SECTION_KINDS = Object.freeze([
  'hero',
  'page-hero',
  'logos',
  'cards',
  'split',
  'faq',
  'prose',
  'final-cta',
  'page-cta',
]);

const CLOSING_KINDS = Object.freeze(['final-cta', 'page-cta']);
const ITEM_KINDS = Object.freeze(['cards', 'split', 'faq', 'prose']);
const DOT_COLORS = Object.freeze(['green', 'cyan', 'purple', 'coral', 'amber', 'blue', 'pink', 'indigo']);
const DEFAULT_ICONS = Object.freeze(['verified-user', 'insights', 'bolt', 'groups', 'schedule', 'security']);

/** `Lead *accent* tail` → the three parts the hero and closing titles render; no asterisks: the last word. */
export const splitAccent = (title) => {
  const marked = /^(.*?)\*([^*]+)\*(.*)$/.exec(title);
  if (marked) {
    return { titleLead: marked[1], titleAccent: marked[2], titleTail: marked[3] };
  }

  const words = title.trim().split(/\s+/);
  const last = words.pop() || '';
  const [, accent = last, tail = ''] = /^(.*?)([.!?]*)$/.exec(last) || [];
  return { titleLead: words.length ? `${words.join(' ')} ` : '', titleAccent: accent, titleTail: tail };
};

const pick = (options, field, locale, fallback) => {
  const value = options[`${field}${locale === 'en' ? 'En' : 'Es'}`];
  return value === undefined || value === '' ? fallback : value;
};

/** The default words of each kind, from the site's own slogan and description. */
const DEFAULTS = {
  en: ({ name, slogan, description }) => ({
    eyebrow: name,
    title: slogan,
    deck: description,
    primary: 'Get started',
    secondary: 'Talk to us',
    recapFrom: 'Where you are today',
    recapTo: 'Where you want to be',
    logosLabel: 'Works with the tools you already use',
    items: [
      'Clear from day one|Everyone sees the same picture, with the next step in plain sight.',
      'Built to grow|Start small and add teams, places and processes as you need them.',
      'Under control|Every change leaves a trace, so nothing depends on memory.',
    ],
    faq: [
      `What is ${name}?|${description}`,
      `How do I start with ${name}?|Create your account and follow the guided setup; the team can help you move what you already have.`,
    ],
    paragraphs: [description],
  }),
  es: ({ name, slogan, description }) => ({
    eyebrow: name,
    title: slogan,
    deck: description,
    primary: 'Empieza ahora',
    secondary: 'Habla con nosotros',
    recapFrom: 'Donde estás hoy',
    recapTo: 'Donde quieres estar',
    logosLabel: 'Funciona con las herramientas que ya usas',
    items: [
      'Claro desde el primer día|Todos ven la misma foto, con el siguiente paso a la vista.',
      'Hecho para crecer|Empieza pequeño y suma equipos, sedes y procesos cuando los necesites.',
      'Bajo control|Cada cambio deja rastro, así nada depende de la memoria.',
    ],
    faq: [
      `¿Qué es ${name}?|${description}`,
      `¿Cómo empiezo con ${name}?|Crea tu cuenta y sigue la configuración guiada; el equipo te ayuda a traer lo que ya tienes.`,
    ],
    paragraphs: [description],
  }),
};

const pairsOf = (items, kind) =>
  items.map((item) => {
    const [first, ...rest] = item.split('|');
    return kind === 'faq'
      ? { q: first.trim(), a: rest.join('|').trim() }
      : { title: first.trim(), body: rest.join('|').trim() };
  });

const itemsFor = (options, kind, locale, words) => {
  const fallback = kind === 'faq' ? words.faq : kind === 'prose' ? words.paragraphs : words.items;
  const given = options[`items${locale === 'en' ? 'En' : 'Es'}`];
  const items = given?.length ? given : locale === 'es' && options.itemsEn?.length ? options.itemsEn : fallback;
  if (kind === 'prose') {
    return items;
  }

  const malformed = items.find((item) => !item.includes('|'));
  if (malformed) {
    throw new LoomError(ERROR_CODES.validation, `Each item of a ${kind} section is "Title|Body": "${malformed}"`, {
      problems: [{ field: `items${locale === 'en' ? 'En' : 'Es'}`, message: 'use Title|Body (faq: Question|Answer)' }],
    });
  }

  return pairsOf(items, kind);
};

/** The copy of one section in one language. */
export const sectionCopy = (options, kind, locale, site) => {
  const words = DEFAULTS[locale]({
    name: site.name,
    slogan: site.slogan[locale],
    description: site.description[locale],
  });
  const text = (field, fallback) => pick(options, field, locale, fallback);
  const imageAlt = options.image ? { imageAlt: text('imageAlt', site.name) } : {};

  if (kind === 'hero') {
    return {
      ...splitAccent(text('title', words.title)),
      deck: text('deck', words.deck),
      primaryCta: text('primary', words.primary),
      secondaryCta: text('secondary', words.secondary),
      ...imageAlt,
    };
  }

  if (kind === 'final-cta') {
    return {
      recapFrom: words.recapFrom,
      recapTo: words.recapTo,
      ...splitAccent(text('title', words.title)),
      deck: text('deck', words.deck),
      primary: text('primary', words.primary),
      secondary: text('secondary', words.secondary),
    };
  }

  if (kind === 'page-hero') {
    return {
      eyebrow: text('eyebrow', words.eyebrow),
      title: text('title', words.title),
      deck: text('deck', words.deck),
      ...imageAlt,
    };
  }

  if (kind === 'page-cta') {
    return {
      title: text('title', words.title),
      deck: text('deck', words.deck),
      primary: text('primary', words.primary),
      secondary: text('secondary', words.secondary),
    };
  }

  if (kind === 'logos') {
    return { label: text('title', words.logosLabel) };
  }

  if (kind === 'faq') {
    return {
      title: text('title', locale === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'),
      items: itemsFor(options, kind, locale, words),
    };
  }

  if (kind === 'prose') {
    return {
      eyebrow: text('eyebrow', ''),
      title: text('title', ''),
      paragraphs: itemsFor(options, kind, locale, words),
    };
  }

  return {
    eyebrow: text('eyebrow', words.eyebrow),
    title: text('title', words.title),
    deck: text('deck', words.deck),
    items: itemsFor(options, kind, locale, words),
    ...imageAlt,
  };
};

const visualsOf = (options) => {
  const icons = options.icons?.length ? options.icons : DEFAULT_ICONS.slice(0, 3);
  return icons.map((icon, index) => ({ icon: `ic:baseline-${icon}`, color: DOT_COLORS[index % DOT_COLORS.length] }));
};

const logosOf = (options) =>
  (options.logos || []).map((entry) => {
    const [name, ...src] = entry.split('=');
    return { name: name.trim(), src: src.join('=').trim() };
  });

/**
 * `add section`: one section of a page, from a standard kind. The component reads its copy from <page>.<id> in both
 * dictionaries, and the page lists it before its closing call to action.
 */
export default async function sectionGenerator(tree, options, context = {}) {
  requireLanding(context.project, 'section');
  const files = within(tree, context.directory);
  const kind = options.kind;
  const id = options.id || kind;
  const name = pascalCase(id);
  const pageKey = camelCase(options.page);
  const sectionKey = camelCase(id);
  const sectionsFile = LANDING_FILES.sections(options.page);
  const componentFile = `${LANDING_FILES.view(options.page)}/sections/${name}.astro`;

  const sections = readRequired(
    files,
    sectionsFile,
    `the page "${options.page}" does not exist (create it with \`add page\`)`,
  );
  if (files.exists(componentFile) && !options.replace) {
    throw new LoomError(ERROR_CODES.targetExists, `${componentFile} already exists`, {
      path: componentFile,
      next: ['Pass another --id, or --replace --yes to write it again'],
    });
  }

  if (ITEM_KINDS.includes(kind) && options.itemsEs?.length && options.itemsEn?.length !== options.itemsEs.length) {
    throw new LoomError(ERROR_CODES.validation, 'itemsEn and itemsEs must have the same number of items', {
      problems: [{ field: 'itemsEs', message: `${options.itemsEs.length} items for ${options.itemsEn?.length || 0}` }],
    });
  }

  const site = { name: context.project.name, ...context.project.site };
  const component = renderTemplate(fs.readFileSync(here(`./kinds/${kind}.astro.ejs`), 'utf8'), {
    name,
    id,
    accessor: `${pageKey}.${sectionKey}`,
    image: options.image || '',
    tone: options.tone || 'white',
    secondaryPath: options.secondaryPath || '/contact',
    visuals: visualsOf(options),
    logos: logosOf(options),
    quote,
  });
  if (files.exists(componentFile)) {
    files.overwrite(componentFile, component);
  } else {
    files.create(componentFile, component);
  }

  addCopy(
    files,
    {
      en: { [pageKey]: { [sectionKey]: sectionCopy(options, kind, 'en', site) } },
      es: { [pageKey]: { [sectionKey]: sectionCopy(options, kind, 'es', site) } },
    },
    { owned: [`${pageKey}.${sectionKey}`], replace: options.replace },
  );

  if (!sections.includes(`id: '${id}'`)) {
    const closing = CLOSING_KINDS.includes(kind)
      ? undefined
      : CLOSING_KINDS.find((cta) => sections.includes(`id: '${cta}'`));
    const imported = addImport(sections, { from: `./sections/${name}.astro`, defaultName: name, file: sectionsFile });
    files.overwrite(
      sectionsFile,
      appendToArray(imported, {
        name: 'SECTIONS',
        element: `{ id: ${quote(id)}, component: ${name} }`,
        id,
        before: closing,
        file: sectionsFile,
      }),
    );
  }

  const spanishMissing =
    !options.titleEs && options.titleEn
      ? ['Spanish copy fell back to the defaults; pass --title-es (and the other *Es flags)']
      : [];
  return {
    warnings: spanishMissing,
    project: { section: { page: options.page, id, kind, component: componentFile, copy: `${pageKey}.${sectionKey}` } },
    next: [],
  };
}
