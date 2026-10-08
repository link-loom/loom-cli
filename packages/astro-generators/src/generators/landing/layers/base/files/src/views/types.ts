import type { Locale } from '@data/site';

/** One section of a page: its id (unique in the page) and the component that renders it for a language. */
export interface Section {
  id: string;
  component: (props: { locale: Locale }) => unknown;
}
