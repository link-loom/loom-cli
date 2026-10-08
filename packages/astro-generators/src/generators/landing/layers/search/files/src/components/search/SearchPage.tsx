import { useEffect, useRef, useState } from 'react';

/*
 * SearchPage — React island for the /search route.
 * Loads the Pagefind client lazily from /pagefind/pagefind.js (generated at build time).
 * Filters by locale so EN search only surfaces EN pages and vice versa.
 */

interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

interface PagefindResultData {
  url: string;
  meta: { title?: string };
  excerpt: string;
  word_count?: number;
  filters?: Record<string, string[]>;
}

interface PagefindClient {
  init: () => Promise<void>;
  search: (query: string, options?: { filters?: Record<string, string> }) => Promise<{ results: PagefindResult[] }>;
  destroy: () => Promise<void>;
}

type Locale = 'en' | 'es';

interface Props {
  locale: Locale;
  placeholder: string;
}

const COPY = {
  en: {
    typing: 'Type at least 2 characters to search.',
    nothing: 'No results for that query yet.',
    error: 'Search is only available after `npm run build` (it relies on the Pagefind index).',
    matchesLabel: (n: number) => `${n} match${n === 1 ? '' : 'es'}`,
    shortcut: 'Press Esc to clear',
  },
  es: {
    typing: 'Escribe al menos 2 caracteres para buscar.',
    nothing: 'Sin resultados para esa búsqueda aún.',
    error: 'La búsqueda solo está disponible después de `npm run build` (depende del índice Pagefind).',
    matchesLabel: (n: number) => `${n} resultado${n === 1 ? '' : 's'}`,
    shortcut: 'Esc para limpiar',
  },
} as const;

export default function SearchPage({ locale, placeholder }: Props) {
  const t = COPY[locale];
  const [client, setClient] = useState<PagefindClient | null>(null);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [hits, setHits] = useState<Array<PagefindResultData>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef<string>('');

  // Initialize Pagefind client on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Build the URL at runtime so Rollup does not try to resolve it.
        // Pagefind is served from the site root after `npm run build`.
        const path = '/' + 'pagefind' + '/' + 'pagefind.js';
        const url = new URL(path, window.location.origin).href;
        const mod = (await import(/* @vite-ignore */ url)) as PagefindClient;
        await mod.init();
        if (!cancelled) setClient(mod);
      } catch {
        if (!cancelled) setError(t.error);
      }
    })();

    inputRef.current?.focus();

    // Read initial ?q= from URL.
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('q') ?? '';
    if (initial) setQuery(initial);

    return () => {
      cancelled = true;
    };
  }, [t.error]);

  // Run search on query change (debounced).
  useEffect(() => {
    if (!client) return;
    const q = query.trim();
    lastQueryRef.current = q;

    if (q.length < 2) {
      setHits([]);
      return;
    }

    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await client.search(q, { filters: { locale } });
        // If the user kept typing while this was running, drop the stale result.
        if (lastQueryRef.current !== q) return;
        const data = await Promise.all(res.results.slice(0, 24).map((r) => r.data()));
        // Filter again by locale path defensively (Pagefind filters depend on data-pagefind-filter attributes).
        const filtered = data.filter((d) => d.url.startsWith(`/${locale}/`));
        setHits(filtered);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(id);
  }, [client, query, locale]);

  // ESC clears the input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasQuery = query.trim().length >= 2;

  return (
    <div className="site-search-root">
      <div className="site-search-bar">
        <svg
          className="site-search-bar__icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <path
            d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm6 0-3.4-3.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          className="site-search-bar__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label={placeholder}
        />
        <kbd className="site-search-bar__kbd">{t.shortcut}</kbd>
      </div>

      {error && <div className="site-search__error">{error}</div>}

      {!error && (
        <div className="site-search__results">
          {!hasQuery && !loading && (
            <p className="site-search__hint">{t.typing}</p>
          )}
          {hasQuery && !loading && hits.length === 0 && (
            <p className="site-search__hint">{t.nothing}</p>
          )}
          {hasQuery && hits.length > 0 && (
            <>
              <p className="site-search__count">{t.matchesLabel(hits.length)}</p>
              <ul className="site-search__list">
                {hits.map((hit) => (
                  <li key={hit.url}>
                    <a className="site-search__hit" href={hit.url}>
                      <span className="site-search__hit-url site-mono">{hit.url}</span>
                      <h3 className="site-search__hit-title">
                        {hit.meta.title || hit.url}
                      </h3>
                      <p
                        className="site-search__hit-excerpt"
                        dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
