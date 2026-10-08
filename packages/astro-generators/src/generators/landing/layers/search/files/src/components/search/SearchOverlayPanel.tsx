import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * SearchOverlayPanel — autocomplete search via Pagefind.
 *
 * Behaviors:
 *   - As the user types, a compact dropdown surfaces up to 7 matches.
 *   - Gmail-style ghost autocomplete: the rest of the first match's title
 *     renders inline; Tab or ArrowRight accepts it.
 *   - Keyboard: ↑↓ moves highlight, Enter navigates, Escape closes overlay.
 *   - Empty state shows curated suggestion chips.
 *   - Pagefind serves the index from /pagefind/. If the index is missing
 *     (no build run yet), a helpful message tells the user what to do.
 */

type PagefindResult = {
  id: string;
  data: () => Promise<{
    url: string;
    excerpt: string;
    meta: { title?: string };
    filters?: Record<string, string[]>;
  }>;
};

type PagefindModule = {
  init?: () => Promise<void>;
  options?: (opts: { baseUrl?: string }) => Promise<void>;
  search: (
    query: string,
    opts?: { filters?: Record<string, string | string[]> },
  ) => Promise<{ results: PagefindResult[] }>;
};

interface Props {
  locale: 'en' | 'es';
  placeholder: string;
  helper: string;
  suggestionsLabel: string;
  suggestions: string[];
  closeLabel: string;
}

const i18n = {
  en: {
    loading: 'Searching…',
    noResults: 'No results.',
    seeAll: (q: string, n: number) => `See all results for "${q}" (${n})`,
    seeAllSimple: (q: string) => `See all results for "${q}"`,
    initError:
      'Search index not loaded. Run `npm run build` once so Pagefind generates the index, then reload.',
  },
  es: {
    loading: 'Buscando…',
    noResults: 'Sin resultados.',
    seeAll: (q: string, n: number) => `Ver todos los resultados de "${q}" (${n})`,
    seeAllSimple: (q: string) => `Ver todos los resultados de "${q}"`,
    initError:
      'El índice de búsqueda no se cargó. Ejecuta `npm run build` una vez para generar el índice de Pagefind y recarga.',
  },
};

type Resolved = { url: string; title: string; excerpt: string };

const MAX_RESULTS = 7;
const MIN_QUERY_LEN = 2;

function highlightTitle(title: string, query: string): { typed: string; rest: string } {
  const lower = title.toLowerCase();
  const lowerQ = query.toLowerCase();
  if (lower.startsWith(lowerQ)) {
    return { typed: title.slice(0, query.length), rest: title.slice(query.length) };
  }
  return { typed: '', rest: title };
}

function closeOverlay() {
  document.dispatchEvent(new CustomEvent('site:search:close'));
}

export default function SearchOverlayPanel({
  locale,
  placeholder,
  helper,
  suggestionsLabel,
  suggestions,
  closeLabel,
}: Props) {
  const t = i18n[locale];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Resolved[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const pagefindRef = useRef<PagefindModule | null>(null);
  const initFailedRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchTokenRef = useRef(0);

  // Autofocus when the overlay opens (driven by class on document body).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    function onOpen() {
      window.setTimeout(() => input?.focus(), 30);
    }
    document.addEventListener('site:search:opened', onOpen);
    return () => document.removeEventListener('site:search:opened', onOpen);
  }, []);

  async function ensurePagefind(): Promise<PagefindModule | null> {
    if (pagefindRef.current) return pagefindRef.current;
    if (initFailedRef.current) return null;
    try {
      // Build URL at runtime to bypass Rollup's static analysis (the index
      // doesn't exist at build time in dev — it's served from public/ post-build).
      const path = '/' + 'pagefind' + '/' + 'pagefind.js';
      const url = new URL(path, window.location.origin).href;
      const mod = (await import(/* @vite-ignore */ url)) as PagefindModule;
      if (mod.options) await mod.options({ baseUrl: '/' });
      if (mod.init) await mod.init();
      pagefindRef.current = mod;
      return mod;
    } catch {
      initFailedRef.current = true;
      setStatus('error');
      return null;
    }
  }

  function runSearch(q: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY_LEN) {
        setResults([]);
        setStatus('idle');
        setHighlightIdx(-1);
        return;
      }
      const token = ++searchTokenRef.current;
      setStatus('searching');
      const pf = await ensurePagefind();
      if (!pf) return;
      const out = await pf.search(trimmed, { filters: { locale } });
      if (token !== searchTokenRef.current) return;
      const resolved = await Promise.all(
        out.results.slice(0, MAX_RESULTS).map(async (r) => {
          const d = await r.data();
          return { url: d.url, title: d.meta?.title ?? d.url, excerpt: d.excerpt };
        }),
      );
      if (token !== searchTokenRef.current) return;
      const lowerQ = trimmed.toLowerCase();
      resolved.sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(lowerQ) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(lowerQ) ? 0 : 1;
        return aStarts - bStarts;
      });
      // Defensive filter: only keep results matching the active locale path.
      const localePrefix = `/${locale}/`;
      const filtered = resolved.filter((r) => r.url.startsWith(localePrefix) || r.url === `/${locale}`);
      setResults(filtered);
      setStatus('idle');
      setHighlightIdx(filtered.length > 0 ? 0 : -1);
    }, 100);
  }

  const ghostSuggestion = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || results.length === 0) return null;
    const lowerQ = trimmed.toLowerCase();
    const match = results.find((r) => r.title.toLowerCase().startsWith(lowerQ));
    if (!match) return null;
    return match.title.slice(query.length);
  }, [query, results]);

  function acceptGhost() {
    if (!ghostSuggestion) return;
    const completed = query + ghostSuggestion;
    setQuery(completed);
    runSearch(completed);
  }

  function navigateToHighlighted() {
    const target = highlightIdx >= 0 ? results[highlightIdx] : results[0];
    if (!target) return;
    closeOverlay();
    window.location.href = target.url;
  }

  function navigateToFullSearch(q: string) {
    closeOverlay();
    window.location.href = `/${locale}/search?q=${encodeURIComponent(q)}`;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    runSearch(e.target.value);
  }

  const trimmedQuery = query.trim();
  const seeAllIdx = results.length;
  const isSeeAllHighlighted = highlightIdx === seeAllIdx;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const maxIdx = results.length > 0 ? results.length : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, maxIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' && ghostSuggestion && !e.shiftKey) {
      e.preventDefault();
      acceptGhost();
    } else if (e.key === 'ArrowRight' && ghostSuggestion) {
      const atEnd = e.currentTarget.selectionStart === query.length;
      if (atEnd) {
        e.preventDefault();
        acceptGhost();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If the see-all row is highlighted → go to /search.
      // Otherwise navigate to the highlighted result (including index 0,
      // which is the default-highlighted first match).
      if (highlightIdx === seeAllIdx) {
        if (trimmedQuery.length >= MIN_QUERY_LEN) navigateToFullSearch(trimmedQuery);
      } else if (highlightIdx >= 0 && results[highlightIdx]) {
        navigateToHighlighted();
      } else if (trimmedQuery.length >= MIN_QUERY_LEN) {
        navigateToFullSearch(trimmedQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    runSearch(suggestion);
    inputRef.current?.focus();
  }

  useEffect(() => () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
  }, []);

  const showSuggestions = trimmedQuery.length < MIN_QUERY_LEN && status !== 'error';
  const showAutocomplete = trimmedQuery.length >= MIN_QUERY_LEN || status === 'error';

  return (
    <div className="site-search-overlay__panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmedQuery.length >= MIN_QUERY_LEN) navigateToFullSearch(trimmedQuery);
        }}
      >
        <div className="site-search-overlay__input-wrap">
          <svg
            className="site-search-overlay__search-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
            fill="currentColor"
          >
            {/* Matches Iconify `ic:baseline-search` (Material Icons baseline). */}
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <div className="site-search-overlay__input-inner">
            <div className="site-search-overlay__ghost" aria-hidden="true">
              <span className="site-search-overlay__ghost-typed">{query}</span>
              {ghostSuggestion && (
                <span className="site-search-overlay__ghost-suggestion">{ghostSuggestion}</span>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              className="site-search-overlay__input"
              placeholder={placeholder}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showAutocomplete && results.length > 0}
              aria-controls="site-search-overlay-listbox"
              aria-autocomplete="both"
            />
          </div>
          <button
            type="button"
            className="site-search-overlay__close"
            onClick={closeOverlay}
            aria-label={closeLabel}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </form>

      <p className="site-search-overlay__helper">{helper}</p>

      {showSuggestions && (
        <div className="site-search-overlay__suggestions">
          <span className="site-search-overlay__suggestions-label">{suggestionsLabel}</span>
          <div className="site-search-overlay__chips">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="site-search-overlay__chip"
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAutocomplete && (
        <div className="site-search-overlay__results">
          {status === 'error' && <p className="site-search-overlay__empty">{t.initError}</p>}
          {status === 'searching' && results.length === 0 && (
            <p className="site-search-overlay__empty">{t.loading}</p>
          )}
          {status === 'idle' && trimmedQuery.length >= MIN_QUERY_LEN && results.length === 0 && (
            <p className="site-search-overlay__empty">{t.noResults}</p>
          )}
          {results.length > 0 && (
            <ul id="site-search-overlay-listbox" role="listbox">
              {results.map((r, i) => {
                const { typed, rest } = highlightTitle(r.title, trimmedQuery);
                return (
                  <li
                    key={r.url}
                    role="option"
                    aria-selected={i === highlightIdx}
                    className={
                      i === highlightIdx
                        ? 'site-search-overlay__row is-highlighted'
                        : 'site-search-overlay__row'
                    }
                  >
                    <a href={r.url} onClick={closeOverlay}>
                      <span className="site-search-overlay__row-title">
                        {typed && <mark>{typed}</mark>}
                        {rest}
                      </span>
                    </a>
                  </li>
                );
              })}
              <li
                className={
                  isSeeAllHighlighted
                    ? 'site-search-overlay__see-all is-highlighted'
                    : 'site-search-overlay__see-all'
                }
                role="option"
                aria-selected={isSeeAllHighlighted}
              >
                <a
                  href={`/${locale}/search?q=${encodeURIComponent(trimmedQuery)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToFullSearch(trimmedQuery);
                  }}
                >
                  {t.seeAll(trimmedQuery, results.length)} →
                </a>
              </li>
            </ul>
          )}
          {status === 'idle' && trimmedQuery.length >= MIN_QUERY_LEN && results.length === 0 && (
            <div className="site-search-overlay__see-all-alone">
              <a
                href={`/${locale}/search?q=${encodeURIComponent(trimmedQuery)}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToFullSearch(trimmedQuery);
                }}
              >
                {t.seeAllSimple(trimmedQuery)} →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
