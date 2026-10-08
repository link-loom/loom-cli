// @ts-check
/*
 * The blog editor: write and edit the posts of src/content/blog in the browser, under `astro dev` only.
 *
 * In development this integration adds the editor's pages (/editor, /editor/new and /editor/edit/<slug>, from
 * src/editor/pages), the middleware that keeps them out of the site's i18n routing (src/editor/middleware.ts) and the
 * editor's HTTP API, which reads and writes the posts' Markdown files:
 *   GET    /api/editor/posts         list the posts
 *   POST   /api/editor/posts         create a post   { frontmatter, body }
 *   GET    /api/editor/posts/<slug>  read a post
 *   PUT    /api/editor/posts/<slug>  update a post   { frontmatter, body }
 *   DELETE /api/editor/posts/<slug>  delete a post
 * A slug is the file name without `.md`: `my-post` in English, `my-post.es` in Spanish.
 *
 * Any other command (build, preview, sync) leaves the site untouched, so neither the pages nor the API reach dist/.
 */

/* The API runs in Node at config time and cannot import TypeScript, so it loads this module through Vite on each
   request: the same validation as the editor's pages, the categories of src/data/blog.ts, and edits picked up live. */
const POST_FILES_MODULE = '/src/editor/post-files.ts';
const API_PREFIX = '/api/editor/';
const POSTS_ROUTE = '/api/editor/posts';
const POST_ROUTE = /^\/api\/editor\/posts\/([^/]+)$/;

const EDITOR_PAGES = [
  { pattern: '/editor', file: './src/editor/pages/index.astro' },
  { pattern: '/editor/new', file: './src/editor/pages/new.astro' },
  { pattern: '/editor/edit/[slug]', file: './src/editor/pages/edit/[slug].astro' },
];
const EDITOR_MIDDLEWARE = './src/editor/middleware.ts';

/** @returns {import('astro').AstroIntegration} */
export default function blogEditor() {
  return {
    name: 'blog-editor',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute, addMiddleware, updateConfig }) => {
        if (command !== 'dev') {
          return;
        }

        // Resolved from the project root, wherever `astro dev` was started.
        for (const page of EDITOR_PAGES) {
          injectRoute({ pattern: page.pattern, entrypoint: new URL(page.file, config.root) });
        }
        addMiddleware({ order: 'pre', entrypoint: new URL(EDITOR_MIDDLEWARE, config.root) });
        updateConfig({ vite: { plugins: [editorApi()] } });
      },
    },
  };
}

/** @returns {import('vite').Plugin} */
function editorApi() {
  return {
    name: 'blog-editor-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (!pathname.startsWith(API_PREFIX)) {
          next();
          return;
        }

        try {
          await handle(server, req, res, pathname);
        } catch (error) {
          server.config.logger.error(`[blog-editor] ${error instanceof Error ? error.stack : String(error)}`);
          sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal error' });
        }
      });
    },
  };
}

/**
 * @param {import('vite').ViteDevServer} server
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 */
async function handle(server, req, res, pathname) {
  const refusal = refuseUntrusted(req);
  if (refusal) {
    sendJson(res, 403, { error: refusal });
    return;
  }

  const slug = pathname === POSTS_ROUTE ? null : POST_ROUTE.exec(pathname)?.[1];
  if (slug === undefined) {
    sendJson(res, 404, { error: `No editor API at ${pathname}` });
    return;
  }

  const method = req.method ?? 'GET';
  const allowed = slug === null ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
  if (!allowed.includes(method)) {
    res.setHeader('allow', allowed.join(', '));
    sendJson(res, 405, { error: `${method} is not allowed here` });
    return;
  }

  const isWrite = method === 'POST' || method === 'PUT';
  if (isWrite && !isJson(req)) {
    sendJson(res, 415, { error: 'Send the post as application/json' });
    return;
  }

  const posts = await server.ssrLoadModule(POST_FILES_MODULE);

  if (slug === null && method === 'GET') {
    sendJson(res, 200, { posts: await posts.listPosts() });
    return;
  }

  if (slug === null) {
    sendResult(res, 201, await posts.createPost(await readJson(req)));
    return;
  }

  if (method === 'GET') {
    const post = await posts.readPost(slug);
    sendJson(res, post ? 200 : 404, post ?? { error: `Post "${slug}" not found` });
    return;
  }

  if (method === 'PUT') {
    sendResult(res, 200, await posts.updatePost(slug, await readJson(req)));
    return;
  }

  sendResult(res, 200, await posts.deletePost(slug));
}

/**
 * The API writes to disk, so it serves the developer's own machine only. Vite's host and CORS checks run after this
 * middleware, so it applies the two that matter itself: the request must name a loopback host (a DNS-rebinding page
 * cannot), and a request a browser sends must come from the editor's own origin (any site can send a simple POST to
 * localhost; the JSON-only writes and the missing CORS headers stop the rest).
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {string | null}
 */
function refuseUntrusted(req) {
  const host = req.headers.host ?? '';
  if (!isLoopback(hostnameOf(`http://${host}`))) {
    return 'The editor API only answers on localhost';
  }

  const origin = req.headers.origin;
  if (origin !== undefined && hostOf(origin) !== host) {
    return 'The editor API only answers to the editor pages';
  }

  return null;
}

/** @param {string} url */
function hostOf(url) {
  return URL.canParse(url) ? new URL(url).host : null;
}

/** @param {string} url */
function hostnameOf(url) {
  return URL.canParse(url) ? new URL(url).hostname : '';
}

/** @param {string} hostname */
function isLoopback(hostname) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    /^127(\.\d{1,3}){3}$/.test(hostname)
  );
}

/** @param {import('node:http').IncomingMessage} req */
function isJson(req) {
  return (req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
}

/**
 * The request body parsed as JSON, or undefined when it is not JSON (post-files.ts answers that with a 400).
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
async function readJson(req) {
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

/**
 * post-files.ts answers `{ ok: true, value }` or `{ ok: false, status, error }`.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {{ ok: true, value: unknown } | { ok: false, status: number, error: string }} result
 */
function sendResult(res, status, result) {
  if (!result.ok) {
    sendJson(res, result.status, { error: result.error });
    return;
  }

  sendJson(res, status, result.value);
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
