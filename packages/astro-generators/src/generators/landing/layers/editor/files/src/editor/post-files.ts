/*
 * The editor's access to the posts in src/content/blog: list, read, create, update and delete their Markdown files.
 * Node only. The editor's pages call it while they render under `astro dev`, and integrations/blog-editor.mjs loads it
 * for the editor's HTTP API, so pages and API read and validate posts the same way. The browser never imports it.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { BLOG_AUTHOR, BLOG_CATEGORIES, type BlogCategory } from '@data/blog';
import { LOCALES, SITE, type Locale } from '@data/site';
import {
  type PostEntry,
  type PostFrontmatter,
  type PostSibling,
  baseSlugOf,
  isBaseSlug,
  isPostSlug,
  localeOfSlug,
  postSlug,
  slugifyTitle,
} from './post';

const POSTS_DIR = fileURLToPath(new URL('../content/blog/', import.meta.url));
const MARKDOWN_EXTENSION = '.md';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PostSummary {
  slug: string;
  /** The post's address in both languages: /<locale>/blog/<baseSlug>. */
  baseSlug: string;
  title: string;
  description: string;
  locale: Locale;
  category: BlogCategory;
  pub_date: string;
  is_draft: boolean;
}

/** One post across its languages: a row of the editor's index. */
export interface PostGroup {
  baseSlug: string;
  /** The version in the site's default language when there is one. */
  canonical: PostSummary;
  variants: Partial<Record<Locale, string>>;
}

export type PostFailure = { ok: false; status: 400 | 404 | 409; error: string };
export type PostResult<T> = { ok: true; value: T } | PostFailure;

interface PostRequest {
  edits: Record<string, unknown>;
  body: string | undefined;
}

const fail = (status: PostFailure['status'], error: string): PostFailure => ({ ok: false, status, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === 'string' && (BLOG_CATEGORIES as readonly string[]).includes(value);
}

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isExistingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A real day written as YYYY-MM-DD: "2026-02-30" is rejected rather than rolled over to March. */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** YAML reads an unquoted date as a Date and a quoted one as text; both become YYYY-MM-DD. */
function isoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = typeof value === 'string' ? value.slice(0, 10) : '';
  return ISO_DATE.test(text) ? text : undefined;
}

/** Every path the editor touches goes through here, so a slug can never leave src/content/blog. */
function filePath(slug: string): string {
  if (!isPostSlug(slug)) {
    throw new Error(`Invalid post slug: ${slug}`);
  }

  return path.join(POSTS_DIR, `${slug}${MARKDOWN_EXTENSION}`);
}

async function readFileIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw error;
  }
}

/** Lenient on purpose: src/content/config.ts is the schema that rejects a broken post, the editor only opens it. */
function toFrontmatter(data: Record<string, unknown>, slug: string): PostFrontmatter {
  return {
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    pub_date: isoDate(data.pub_date) ?? today(),
    category: isBlogCategory(data.category) ? data.category : BLOG_CATEGORIES[0],
    author: optionalText(data.author) ?? BLOG_AUTHOR,
    cover_image: optionalText(data.cover_image),
    og_image: optionalText(data.og_image),
    is_draft: data.is_draft === true,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    locale: isLocale(data.locale) ? data.locale : localeOfSlug(slug),
    base_slug: optionalText(data.base_slug),
  };
}

/** The fields in the order of src/content/config.ts; empty optional fields are left out of the file. */
function composeMarkdown({ frontmatter, body }: PostEntry): string {
  const fields: Record<string, unknown> = {
    title: frontmatter.title,
    description: frontmatter.description,
    pub_date: frontmatter.pub_date,
    category: frontmatter.category,
    author: frontmatter.author,
    cover_image: frontmatter.cover_image,
    og_image: frontmatter.og_image,
    is_draft: frontmatter.is_draft,
    tags: frontmatter.tags,
    locale: frontmatter.locale,
    base_slug: frontmatter.base_slug,
  };
  const data = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const text = body.replace(/^(\r?\n)+/, '').trimEnd();
  return matter.stringify(text ? `\n${text}` : '', data);
}

function summarize({ slug, frontmatter }: PostEntry): PostSummary {
  return {
    slug,
    baseSlug: frontmatter.base_slug ?? baseSlugOf(slug),
    title: frontmatter.title,
    description: frontmatter.description,
    locale: frontmatter.locale,
    category: frontmatter.category,
    pub_date: frontmatter.pub_date,
    is_draft: frontmatter.is_draft,
  };
}

/** Drafts first, then the newest. */
function byDraftThenDate(first: PostSummary, second: PostSummary): number {
  if (first.is_draft !== second.is_draft) {
    return first.is_draft ? -1 : 1;
  }
  return second.pub_date.localeCompare(first.pub_date);
}

function parseRequest(payload: unknown): PostResult<PostRequest> {
  if (!isRecord(payload)) {
    return fail(400, 'The request body must be a JSON object');
  }

  const edits = payload.frontmatter ?? {};
  if (!isRecord(edits)) {
    return fail(400, 'frontmatter must be an object');
  }

  const body = payload.body;
  if (body !== undefined && typeof body !== 'string') {
    return fail(400, 'body must be text');
  }

  return { ok: true, value: { edits, body } };
}

/**
 * Applies what the author may change. `locale` and `base_slug` are the post's identity (its file name and its address
 * in both languages): they are set when the post is created and never through an edit.
 */
function applyEdits(current: PostFrontmatter, edits: Record<string, unknown>): PostResult<PostFrontmatter> {
  const next: PostFrontmatter = { ...current };

  if (edits.title !== undefined) {
    if (typeof edits.title !== 'string') return fail(400, 'title must be text');
    next.title = edits.title.trim();
  }

  if (edits.description !== undefined) {
    if (typeof edits.description !== 'string') return fail(400, 'description must be text');
    next.description = edits.description.trim();
  }

  if (edits.pub_date !== undefined) {
    if (!isCalendarDate(edits.pub_date)) return fail(400, 'pub_date must be a date as YYYY-MM-DD');
    next.pub_date = edits.pub_date;
  }

  if (edits.category !== undefined) {
    if (!isBlogCategory(edits.category)) return fail(400, `category must be one of: ${BLOG_CATEGORIES.join(', ')}`);
    next.category = edits.category;
  }

  if (edits.author !== undefined) {
    if (typeof edits.author !== 'string') return fail(400, 'author must be text');
    next.author = edits.author.trim();
  }

  if (edits.cover_image !== undefined) {
    if (typeof edits.cover_image !== 'string') return fail(400, 'cover_image must be text');
    next.cover_image = optionalText(edits.cover_image);
  }

  if (edits.og_image !== undefined) {
    if (typeof edits.og_image !== 'string') return fail(400, 'og_image must be text');
    next.og_image = optionalText(edits.og_image);
  }

  if (edits.is_draft !== undefined) {
    if (typeof edits.is_draft !== 'boolean') return fail(400, 'is_draft must be true or false');
    next.is_draft = edits.is_draft;
  }

  if (edits.tags !== undefined) {
    const tags: unknown = edits.tags;
    const isTextList = Array.isArray(tags) && tags.every((tag) => typeof tag === 'string');
    if (!isTextList) return fail(400, 'tags must be a list of text');
    next.tags = tags.map((tag: string) => tag.trim()).filter(Boolean);
  }

  if (!next.title) {
    return fail(400, 'title is required');
  }

  if (!next.author) {
    return fail(400, 'author is required');
  }

  return { ok: true, value: next };
}

async function writePost(entry: PostEntry, { create }: { create: boolean }): Promise<PostResult<PostEntry>> {
  try {
    // `wx` fails when the file exists, so two creations of the same post can never overwrite each other.
    await fs.writeFile(filePath(entry.slug), composeMarkdown(entry), { encoding: 'utf8', flag: create ? 'wx' : 'w' });
  } catch (error) {
    if (create && isExistingFile(error)) {
      return fail(409, `src/content/blog/${entry.slug}${MARKDOWN_EXTENSION} already exists`);
    }
    throw error;
  }

  return { ok: true, value: entry };
}

export async function readPost(slug: string): Promise<PostEntry | null> {
  if (!isPostSlug(slug)) {
    return null;
  }

  const source = await readFileIfExists(filePath(slug));
  if (source === null) {
    return null;
  }

  const { data, content } = matter(source);
  return { slug, frontmatter: toFrontmatter(data, slug), body: content };
}

/** The posts the editor can open: Markdown files whose names follow the post naming rule. */
export async function listPosts(): Promise<PostSummary[]> {
  const files = await fs.readdir(POSTS_DIR).catch((error: unknown) => {
    if (isMissingFile(error)) {
      return [];
    }
    throw error;
  });

  const slugs = files
    .filter((file) => file.endsWith(MARKDOWN_EXTENSION))
    .map((file) => file.slice(0, -MARKDOWN_EXTENSION.length))
    .filter(isPostSlug);
  const entries = await Promise.all(slugs.map(readPost));

  return entries
    .filter((entry): entry is PostEntry => entry !== null)
    .map(summarize)
    .sort(byDraftThenDate);
}

export async function listPostGroups(): Promise<PostGroup[]> {
  const groups = new Map<string, PostGroup>();

  for (const post of await listPosts()) {
    const group = groups.get(post.baseSlug);
    if (!group) {
      groups.set(post.baseSlug, { baseSlug: post.baseSlug, canonical: post, variants: { [post.locale]: post.slug } });
      continue;
    }

    group.variants[post.locale] = post.slug;
    if (post.locale === SITE.defaultLocale) {
      group.canonical = post;
    }
  }

  return [...groups.values()].sort((first, second) => byDraftThenDate(first.canonical, second.canonical));
}

export async function findSibling(entry: PostEntry): Promise<PostSibling> {
  const locale: Locale = entry.frontmatter.locale === 'en' ? 'es' : 'en';
  const slug = postSlug(entry.frontmatter.base_slug ?? baseSlugOf(entry.slug), locale);
  if (!isPostSlug(slug)) {
    return { locale, slug, exists: false };
  }

  return { locale, slug, exists: (await readFileIfExists(filePath(slug))) !== null };
}

/** A new post file. Its name comes from `base_slug` (or the title) and `locale`: `<base>.md` or `<base>.es.md`. */
export async function createPost(payload: unknown): Promise<PostResult<PostEntry>> {
  const request = parseRequest(payload);
  if (!request.ok) {
    return request;
  }

  const { edits, body } = request.value;
  const locale = edits.locale;
  if (!isLocale(locale)) {
    return fail(400, `locale must be one of: ${LOCALES.join(', ')}`);
  }

  const draft: PostFrontmatter = {
    title: '',
    description: '',
    pub_date: today(),
    category: BLOG_CATEGORIES[0],
    author: BLOG_AUTHOR,
    is_draft: true,
    tags: [],
    locale,
  };
  const fields = applyEdits(draft, edits);
  if (!fields.ok) {
    return fields;
  }

  const baseSlug = optionalText(edits.base_slug) ?? slugifyTitle(fields.value.title);
  if (!baseSlug) {
    return fail(400, 'The title has no letters or digits to build the address from: set base_slug');
  }

  if (!isBaseSlug(baseSlug)) {
    return fail(400, 'base_slug must be lowercase letters, digits and dashes');
  }

  const entry: PostEntry = {
    slug: postSlug(baseSlug, locale),
    frontmatter: { ...fields.value, base_slug: baseSlug },
    body: body ?? '',
  };
  return writePost(entry, { create: true });
}

export async function updatePost(slug: string, payload: unknown): Promise<PostResult<PostEntry>> {
  if (!isPostSlug(slug)) {
    return fail(400, `Invalid post slug: ${slug}`);
  }

  const current = await readPost(slug);
  if (!current) {
    return fail(404, `Post "${slug}" not found`);
  }

  const request = parseRequest(payload);
  if (!request.ok) {
    return request;
  }

  const fields = applyEdits(current.frontmatter, request.value.edits);
  if (!fields.ok) {
    return fields;
  }

  return writePost({ slug, frontmatter: fields.value, body: request.value.body ?? current.body }, { create: false });
}

export async function deletePost(slug: string): Promise<PostResult<{ slug: string }>> {
  if (!isPostSlug(slug)) {
    return fail(400, `Invalid post slug: ${slug}`);
  }

  try {
    await fs.unlink(filePath(slug));
  } catch (error) {
    if (isMissingFile(error)) {
      return fail(404, `Post "${slug}" not found`);
    }
    throw error;
  }

  return { ok: true, value: { slug } };
}
