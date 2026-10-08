/*
 * The blog editor's form: the frontmatter, the body in the Link Loom rich text editor and an optional live preview.
 * A developer tool that only exists under `astro dev`, so its words are English only and no visitor ever sees them.
 *
 * The TextEditor takes its initial content as URI-encoded HTML (`modelraw`) and reports every change as URI-encoded
 * Markdown (`outputFormat="markdown"`). It does not read Markdown, so the stored body goes through `marked` first.
 */
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
// @ts-expect-error: the SDK ships JavaScript without type declarations; TextEditorProps types what the editor uses.
import { TextEditor as UntypedTextEditor } from '@link-loom/react-sdk';
import '@link-loom/react-sdk/dist/styles.css';
import { marked } from 'marked';
import { BLOG_AUTHOR, BLOG_CATEGORIES, BLOG_CATEGORY_LABELS, type BlogCategory } from '@data/blog';
import { LOCALES, SITE, type Locale } from '@data/site';
import { type PostEntry, type PostFrontmatter, type PostSibling, baseSlugOf, slugifyTitle } from './post';

type ToolbarOption =
  | 'undo'
  | 'heading'
  | 'list'
  | 'blockquote'
  | 'codeBlock'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link';

interface TextEditorProps {
  id: string;
  modelraw: string;
  outputFormat: 'markdown';
  syncMode: 'uncontrolled';
  minRows: number;
  autoGrow: boolean;
  toolbarOptions: ToolbarOption[];
  onModelChange: (change: { model: string }) => void;
}

const TextEditor = UntypedTextEditor as ComponentType<TextEditorProps>;

/*
 * Only the tools whose result survives the trip to Markdown: the SDK's Markdown output drops underline and highlight,
 * and its image button inserts a placeholder instead of uploading. Images live in public/images and are referenced
 * from the post's file or set as its cover.
 */
const TOOLBAR: ToolbarOption[] = [
  'undo',
  'heading',
  'list',
  'blockquote',
  'codeBlock',
  'bold',
  'italic',
  'strike',
  'code',
  'link',
];

const POSTS_API = '/api/editor/posts';
const JSON_HEADERS = { 'content-type': 'application/json' };
const SAVED_MESSAGE_MS = 2500;

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'saved'; message: string }
  | { kind: 'error'; message: string };

type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface Props {
  /** The post being edited, or null for a new one. */
  entry: PostEntry | null;
  sibling?: PostSibling;
}

const postApi = (slug: string) => `${POSTS_API}/${encodeURIComponent(slug)}`;
const editPage = (slug: string) => `/editor/edit/${encodeURIComponent(slug)}`;

function markdownToHtml(markdown: string): string {
  return markdown ? marked.parse(markdown, { async: false }) : '';
}

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Today in the author's time zone, as a date input writes it. */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function newPost(): PostFrontmatter {
  return {
    title: '',
    description: '',
    pub_date: localToday(),
    category: BLOG_CATEGORIES[0],
    author: BLOG_AUTHOR,
    cover_image: '',
    og_image: '',
    is_draft: true,
    tags: [],
    locale: SITE.defaultLocale,
    base_slug: '',
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) {
      return { ok: true, value: data as T };
    }

    const hasError = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string';
    return { ok: false, error: hasError ? String(data.error) : `The editor API answered ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The editor API did not answer' };
  }
}

/* Material Symbols outline icons, inline: the site's astro-icon set is not available inside a React island. */
const IconTune = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

export default function PostEditor({ entry, sibling }: Props) {
  const isNew = entry === null;
  const [frontmatter, setFrontmatter] = useState<PostFrontmatter>(() => entry?.frontmatter ?? newPost());
  const [body, setBody] = useState(entry?.body ?? '');
  const [tagsText, setTagsText] = useState(() => (entry?.frontmatter.tags ?? []).join(', '));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showFrontmatter, setShowFrontmatter] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  // A new post's address follows its title until the author types one.
  const baseSlugEdited = useRef(false);

  const editorId = `post-editor-${entry?.slug ?? 'new'}`;
  const initialModel = useMemo(() => encodeURIComponent(markdownToHtml(entry?.body ?? '')), [entry]);
  const previewHtml = useMemo(() => (showPreview ? markdownToHtml(body) : ''), [body, showPreview]);
  const isBusy = status.kind === 'busy';

  useEffect(() => {
    if (status.kind !== 'saved') {
      return;
    }

    const timer = window.setTimeout(() => setStatus({ kind: 'idle' }), SAVED_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  function update<K extends keyof PostFrontmatter>(key: K, value: PostFrontmatter[K]) {
    setFrontmatter((previous) => ({ ...previous, [key]: value }));
  }

  function changeTitle(title: string) {
    setFrontmatter((previous) => ({
      ...previous,
      title,
      base_slug: isNew && !baseSlugEdited.current ? slugifyTitle(title) : previous.base_slug,
    }));
  }

  function changeBaseSlug(baseSlug: string) {
    baseSlugEdited.current = true;
    update('base_slug', baseSlug);
  }

  function changeBody(change: { model: string }) {
    setBody(decodeURIComponent(change.model));
  }

  function payload(overrides: Partial<PostFrontmatter>) {
    return JSON.stringify({ frontmatter: { ...frontmatter, tags: parseTags(tagsText), ...overrides }, body });
  }

  async function save(isDraft: boolean) {
    setStatus({ kind: 'busy', message: 'Saving…' });
    const result = await requestJson<PostEntry>(entry === null ? POSTS_API : postApi(entry.slug), {
      method: entry === null ? 'POST' : 'PUT',
      headers: JSON_HEADERS,
      body: payload({ is_draft: isDraft }),
    });

    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }

    if (entry === null) {
      window.location.href = editPage(result.value.slug);
      return;
    }

    setFrontmatter(result.value.frontmatter);
    setTagsText(result.value.frontmatter.tags.join(', '));
    setStatus({ kind: 'saved', message: isDraft ? 'Saved as draft' : 'Published' });
  }

  /** On an existing post, the language switch opens the other version, or creates it from this one. */
  async function changeLocale(locale: Locale) {
    if (locale === frontmatter.locale) {
      return;
    }

    if (entry === null) {
      update('locale', locale);
      return;
    }

    if (sibling?.exists) {
      window.location.href = editPage(sibling.slug);
      return;
    }

    const language = locale.toUpperCase();
    const confirmed = window.confirm(`There is no ${language} version yet. Create it as a draft from this one?`);
    if (!confirmed) {
      return;
    }

    setStatus({ kind: 'busy', message: `Creating the ${language} version…` });
    const baseSlug = frontmatter.base_slug ?? baseSlugOf(entry.slug);
    const result = await requestJson<PostEntry>(POSTS_API, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: payload({ locale, base_slug: baseSlug, is_draft: true }),
    });

    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }

    window.location.href = editPage(result.value.slug);
  }

  async function remove() {
    if (entry === null) {
      return;
    }

    const confirmed = window.confirm(`Delete "${frontmatter.title}"? This removes src/content/blog/${entry.slug}.md.`);
    if (!confirmed) {
      return;
    }

    setStatus({ kind: 'busy', message: 'Deleting…' });
    const result = await requestJson<{ slug: string }>(postApi(entry.slug), { method: 'DELETE' });
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }

    window.location.href = '/editor/';
  }

  const otherLanguage = sibling?.locale.toUpperCase();
  const localeHint = sibling?.exists
    ? `Switch to open the ${otherLanguage} version.`
    : `Switch to create the ${otherLanguage} version from this one.`;

  return (
    <div className="site-post-editor">
      <header className="site-post-editor__header">
        <div>
          <h1 className="site-post-editor__title">{isNew ? 'New post' : `Editing: ${entry.slug}`}</h1>
          {!isNew && (
            <p className="site-post-editor__file">
              <code>src/content/blog/{entry.slug}.md</code>
            </p>
          )}
        </div>

        <div className="site-post-editor__status">
          {status.kind !== 'idle' && (
            <span className={`site-post-editor__badge site-post-editor__badge--${status.kind}`} role="status">
              {status.message}
            </span>
          )}
          <button
            type="button"
            className="site-post-editor__toggle"
            onClick={() => setShowFrontmatter((visible) => !visible)}
            aria-pressed={showFrontmatter}
          >
            <IconTune />
            Frontmatter
          </button>
          <button
            type="button"
            className="site-post-editor__toggle"
            onClick={() => setShowPreview((visible) => !visible)}
            aria-pressed={showPreview}
          >
            <IconEye />
            Preview
          </button>
        </div>
      </header>

      <div className="site-post-editor__grid" data-frontmatter={showFrontmatter} data-preview={showPreview}>
        {showFrontmatter && (
          <aside className="site-post-editor__pane site-post-editor__pane--frontmatter">
            <h2 className="site-post-editor__pane-title">Frontmatter</h2>

            <label className="site-post-editor__field">
              <span>Title</span>
              <input type="text" value={frontmatter.title} onChange={(event) => changeTitle(event.target.value)} />
            </label>

            <label className="site-post-editor__field">
              <span>Description</span>
              <textarea
                rows={3}
                value={frontmatter.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="One sentence for the post cards and the search engines"
              />
            </label>

            <div className="site-post-editor__row">
              <label className="site-post-editor__field">
                <span>Category</span>
                <select
                  value={frontmatter.category}
                  onChange={(event) => update('category', event.target.value as BlogCategory)}
                >
                  {BLOG_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {BLOG_CATEGORY_LABELS[category].en}
                    </option>
                  ))}
                </select>
              </label>

              <label className="site-post-editor__field">
                <span>Language</span>
                <select
                  value={frontmatter.locale}
                  onChange={(event) => changeLocale(event.target.value as Locale)}
                  disabled={isBusy}
                >
                  {LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </option>
                  ))}
                </select>
                {!isNew && <small className="site-post-editor__hint">{localeHint}</small>}
              </label>
            </div>

            <label className="site-post-editor__field">
              <span>Author</span>
              <input
                type="text"
                value={frontmatter.author}
                onChange={(event) => update('author', event.target.value)}
              />
            </label>

            <label className="site-post-editor__field">
              <span>Publication date</span>
              <input
                type="date"
                value={frontmatter.pub_date}
                onChange={(event) => update('pub_date', event.target.value)}
              />
            </label>

            <label className="site-post-editor__field">
              <span>Base slug</span>
              <input
                type="text"
                value={frontmatter.base_slug ?? ''}
                onChange={(event) => changeBaseSlug(event.target.value)}
                placeholder="from-the-title"
                disabled={!isNew}
              />
              <small className="site-post-editor__hint">
                {isNew
                  ? 'The address in both languages: /en/blog/<slug> and /es/blog/<slug>.'
                  : 'Fixed once the post exists: it is the address of both language versions.'}
              </small>
            </label>

            <label className="site-post-editor__field">
              <span>Cover image</span>
              <input
                type="text"
                value={frontmatter.cover_image ?? ''}
                onChange={(event) => update('cover_image', event.target.value)}
                placeholder="/images/blog/cover.webp"
              />
            </label>

            <label className="site-post-editor__field">
              <span>Share image</span>
              <input
                type="text"
                value={frontmatter.og_image ?? ''}
                onChange={(event) => update('og_image', event.target.value)}
                placeholder="Optional: the cover image when empty"
              />
            </label>

            <label className="site-post-editor__field">
              <span>Tags, separated by commas</span>
              <input type="text" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
            </label>
          </aside>
        )}

        <section className="site-post-editor__pane site-post-editor__pane--body">
          <h2 className="site-post-editor__pane-title">Body</h2>
          <div className="site-post-editor__text">
            <TextEditor
              key={editorId}
              id={editorId}
              modelraw={initialModel}
              outputFormat="markdown"
              syncMode="uncontrolled"
              minRows={20}
              autoGrow
              toolbarOptions={TOOLBAR}
              onModelChange={changeBody}
            />
          </div>
        </section>

        {showPreview && (
          <section className="site-post-editor__pane site-post-editor__pane--preview">
            <h2 className="site-post-editor__pane-title">Preview</h2>
            <div className="site-post-editor__preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </section>
        )}
      </div>

      <footer className="site-post-editor__footer">
        {!isNew && (
          <button type="button" className="site-post-editor__delete" onClick={remove} disabled={isBusy}>
            Delete
          </button>
        )}
        <button
          type="button"
          className="site-btn site-btn--secondary site-btn--sm"
          onClick={() => save(true)}
          disabled={isBusy || !frontmatter.title.trim()}
        >
          Save as draft
        </button>
        <button
          type="button"
          className="site-btn site-btn--primary site-btn--sm"
          onClick={() => save(false)}
          disabled={isBusy || !frontmatter.title.trim()}
        >
          {frontmatter.is_draft ? 'Publish' : 'Save published'}
        </button>
      </footer>
    </div>
  );
}
