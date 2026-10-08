import type { Locale } from '@data/site';
import { COPY as COPY_EN } from '@data/copy/en';
import { COPY as COPY_ES } from '@data/copy/es';

/** Every text of the site in one language. Both dictionaries have the same keys; `link-loom check` verifies it. */
export function getCopy(locale: Locale) {
  return locale === 'es' ? COPY_ES : COPY_EN;
}
