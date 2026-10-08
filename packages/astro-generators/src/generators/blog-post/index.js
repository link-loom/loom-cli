import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { LOCALES, requireLanding, within } from '../shared/project.js';

const POSTS_DIR = 'src/content/blog';

const yamlString = (value) => JSON.stringify(String(value));

const frontmatter = (fields) =>
  `---\n${Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${key}: ${Array.isArray(value) ? `[${value.map(yamlString).join(', ')}]` : typeof value === 'string' ? yamlString(value) : value}`,
    )
    .join('\n')}\n---\n`;

const PLACEHOLDER = {
  en: (title) =>
    `${title}.\n\n## Why it matters\n\nWrite the post here: one idea per section, short paragraphs, concrete examples.\n`,
  es: (title) =>
    `${title}.\n\n## Por qué importa\n\nEscribe aquí la publicación: una idea por sección, párrafos cortos, ejemplos concretos.\n`,
};

/** `add blog-post`: the same post in English and Spanish, parallel by base_slug. */
export default async function blogPostGenerator(tree, options, context = {}) {
  requireLanding(context.project, 'blog-post');
  if (!context.project.layers?.includes('blog')) {
    throw new LoomError(ERROR_CODES.notAvailable, 'This landing has no blog layer');
  }

  const categories = (context.project.blog?.categories || []).map((category) => category.id);
  const category = options.category || categories[0];
  if (!categories.includes(category)) {
    throw new LoomError(ERROR_CODES.validation, `Unknown category "${category}"`, {
      problems: [{ field: 'category', message: `one of ${categories.join(', ')}` }],
    });
  }

  const files = within(tree, context.directory);
  const paths = { en: `${POSTS_DIR}/${options.slug}.md`, es: `${POSTS_DIR}/${options.slug}.es.md` };
  const taken = LOCALES.find((locale) => files.exists(paths[locale]));
  if (taken && !options.replace) {
    throw new LoomError(ERROR_CODES.targetExists, `${paths[taken]} already exists`, {
      path: paths[taken],
      next: ['Pass --replace --yes to write it again'],
    });
  }

  const site = context.project.site || { description: { en: '', es: '' } };
  const text = {
    title: { en: options.titleEn, es: options.titleEs || options.titleEn },
    description: {
      en: options.descriptionEn || site.description.en,
      es: options.descriptionEs || options.descriptionEn || site.description.es,
    },
  };
  const pubDate = options.pubDate || new Date().toISOString().slice(0, 10);

  for (const locale of LOCALES) {
    const body =
      (locale === 'en' ? options.bodyEn : options.bodyEs || options.bodyEn) || PLACEHOLDER[locale](text.title[locale]);
    (files.exists(paths[locale]) ? files.overwrite : files.create)(
      paths[locale],
      `${frontmatter({
        title: text.title[locale],
        description: text.description[locale],
        pub_date: pubDate,
        category,
        author: options.author || context.project.name,
        cover_image: options.coverImage,
        is_draft: options.draft,
        tags: options.tags,
        locale,
        base_slug: options.slug,
      })}\n${body.trim()}\n`,
    );
  }

  return {
    warnings: options.titleEs
      ? []
      : ['Spanish copy fell back to English; pass --title-es, --description-es and --body-es'],
    project: { post: { slug: options.slug, paths: Object.values(paths), url: `/en/blog/${options.slug}` } },
    next: [],
  };
}
