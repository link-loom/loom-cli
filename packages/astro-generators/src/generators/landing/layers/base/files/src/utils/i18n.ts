import { SITE, type Locale } from '@data/site';

/**
 * Replaces the locale prefix in a pathname to switch languages
 * while preserving the rest of the route.
 *   /en/blog/foo  +  'es'  →  /es/blog/foo
 *   /es/         +  'en'  →  /en/
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const stripped = pathname.replace(/^\/(en|es)(?=\/|$)/, '');
  const tail = stripped || '/';
  const normalized = tail.startsWith('/') ? tail : `/${tail}`;
  return `/${target}${normalized}`;
}

/** The locale segment of a pathname; the site's default when there is none. */
export function localeFromPath(pathname: string): Locale {
  const match = pathname.match(/^\/(en|es)(?=\/|$)/);
  return (match?.[1] as Locale) ?? SITE.defaultLocale;
}

export function isLocale(value: string): value is Locale {
  return value === 'en' || value === 'es';
}

export function localeLabel(locale: Locale): string {
  return locale === 'es' ? 'ES' : 'EN';
}

/** OG locale tag (en_US / es_ES) */
export function ogLocale(locale: Locale): string {
  return locale === 'es' ? 'es_ES' : 'en_US';
}

/** HTML lang attribute */
export function htmlLang(locale: Locale): string {
  return locale === 'es' ? 'es' : 'en';
}

/**
 * Builds a localized URL path with proper leading slash and locale prefix.
 *   localizedPath('en', '/blog/foo')  →  '/en/blog/foo'
 *   localizedPath('es', 'about')     →  '/es/about'
 */
export function localizedPath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '/' : clean}`;
}
