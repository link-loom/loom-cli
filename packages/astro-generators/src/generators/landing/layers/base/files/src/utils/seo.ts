import { SITE, type Locale } from '@data/site';

export interface SeoArticle {
  publishedTime: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface SeoProps {
  /** Page-specific title. The site name is appended automatically. */
  title?: string;
  /** Meta description. Falls back to SITE.description[locale]. */
  description?: string;
  /** OG image URL. Falls back to the site's share image of the locale. */
  ogImage?: string;
  /** OG type. Default: 'website'. */
  ogType?: 'website' | 'article' | 'profile';
  /** When true, sets robots to noindex,nofollow. */
  noindex?: boolean;
  /** Map of locale → URL path for hreflang alternates. */
  alternateLocales?: Partial<Record<Locale, string>>;
  /** Override the canonical URL. Default: Astro.url.href. */
  canonical?: string;
  /** Article metadata (use for blog posts). */
  article?: SeoArticle;
  /** Locale for og:locale + html lang. */
  locale?: Locale;
}

/**
 * Builds a final <title>. Avoids duplicating the site name if the
 * caller already included it.
 */
export function buildTitle(pageTitle?: string, locale: Locale = SITE.defaultLocale): string {
  if (!pageTitle) {
    return `${SITE.name} · ${SITE.slogan[locale]}`;
  }
  if (pageTitle.toLowerCase().includes(SITE.name.toLowerCase())) {
    return pageTitle;
  }
  return `${pageTitle} · ${SITE.name}`;
}

/**
 * Converts a relative path into an absolute URL using SITE.url.
 * Passes through fully-qualified URLs unchanged.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = SITE.url.replace(/\/$/, '');
  const relative = path.startsWith('/') ? path : `/${path}`;
  return `${base}${relative}`;
}
