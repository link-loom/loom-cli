import type { CollectionEntry } from 'astro:content';
import type { Locale } from '@data/site';

export type BlogEntry = CollectionEntry<'blog'>;

export { BLOG_CATEGORY_LABELS } from '@data/blog';

export function postSlug(entry: BlogEntry): string {
  return entry.data.base_slug ?? entry.slug;
}

export function postHref(entry: BlogEntry, locale: Locale): string {
  return `/${locale}/blog/${postSlug(entry)}`;
}

/** A post's date as its front matter says it: the date is a day, not a moment, so it is read in UTC. */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
