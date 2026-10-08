/*
 * A blog post as the editor sees it, and the naming rules the browser and the server share. A post is one Markdown file
 * per language in src/content/blog, `<base>.md` in English and `<base>.es.md` in Spanish, both with
 * `base_slug: <base>`, so the public addresses are parallel: /en/blog/<base> and /es/blog/<base>. A file's slug is its
 * name without `.md`. Nothing here touches the file system: the editor's React island imports it too.
 */
import type { BlogCategory } from '@data/blog';
import type { Locale } from '@data/site';

/** The frontmatter of src/content/config.ts, with the date as YYYY-MM-DD (what a date input reads and writes). */
export interface PostFrontmatter {
  title: string;
  description: string;
  pub_date: string;
  category: BlogCategory;
  author: string;
  cover_image?: string;
  og_image?: string;
  is_draft: boolean;
  tags: string[];
  locale: Locale;
  base_slug?: string;
}

export interface PostEntry {
  slug: string;
  frontmatter: PostFrontmatter;
  body: string;
}

/** The same post in the other language, written or not yet. */
export interface PostSibling {
  locale: Locale;
  slug: string;
  exists: boolean;
}

/** The same rule `link-loom add blog-post` applies to a post's address. */
const BASE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SPANISH_SUFFIX = '.es';
const MAX_SLUG_LENGTH = 80;

export function isBaseSlug(value: string): boolean {
  return BASE_SLUG.test(value);
}

/** The address a file name implies, for files written by hand without `base_slug`. */
export function baseSlugOf(slug: string): string {
  return slug.endsWith(SPANISH_SUFFIX) ? slug.slice(0, -SPANISH_SUFFIX.length) : slug;
}

/** Only names the editor itself would write: no dot but the language suffix, no path separator. */
export function isPostSlug(value: string): boolean {
  return isBaseSlug(baseSlugOf(value));
}

export function postSlug(baseSlug: string, locale: Locale): string {
  return locale === 'es' ? `${baseSlug}${SPANISH_SUFFIX}` : baseSlug;
}

export function localeOfSlug(slug: string): Locale {
  return slug.endsWith(SPANISH_SUFFIX) ? 'es' : 'en';
}

/** "¿Qué es Acme?" becomes "que-es-acme": accents are dropped rather than turned into dashes. */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}
