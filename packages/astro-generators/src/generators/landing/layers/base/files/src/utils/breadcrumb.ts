import type { Locale } from '@data/site';
import { PAGES } from '@data/pages';
import { getCopy } from '@utils/copy';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

const humanize = (segment: string) => segment.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/**
 * The trail from the locale home to the current page, each step named by its entry in data/pages.ts. A folder that
 * is not a page (/legal of /legal/privacy) is no step: every link of the trail opens a page. The last step is the
 * current page; `finalLabel` names it when the page knows better (a post's title).
 */
export function buildBreadcrumb(locale: Locale, pathname: string, finalLabel?: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: getCopy(locale).nav.home, href: `/${locale}/` }];
  const tail = pathname.replace(new RegExp(`^/${locale}/?`), '').replace(/\/$/, '');
  if (!tail) return items;

  const segments = tail.split('/');
  let path = '';
  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    const page = PAGES.find((entry) => entry.path === path);
    if (!page && !isLast) return;
    const label = isLast && finalLabel ? finalLabel : (page?.title[locale] ?? humanize(segment));
    items.push({ label, href: `/${locale}${path}` });
  });

  return items;
}
