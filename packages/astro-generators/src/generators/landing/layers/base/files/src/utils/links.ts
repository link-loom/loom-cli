import { SITE, type Locale } from '@data/site';
import type { NavLink } from '@data/nav';
import { localizedPath } from '@utils/i18n';

/** Where a navigation link goes in a language: the localized page, or its outside address. */
export function linkHref(link: NavLink, locale: Locale): string {
  return link.href ?? localizedPath(locale, link.path ?? '/');
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Every "get started" of the site: the product's sign-up, or the contact page when there is none. */
export function signUpHref(locale: Locale): string {
  return SITE.auth.signUp || localizedPath(locale, '/contact');
}
