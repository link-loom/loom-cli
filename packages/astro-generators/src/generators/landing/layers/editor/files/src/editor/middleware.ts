/*
 * Every page of the site lives under /en/ or /es/, and Astro's i18n routing answers 404 to a page outside them, even
 * one it rendered. The editor lives at /editor, so its responses carry the header Astro sets itself to tell that
 * routing to leave a response alone. integrations/blog-editor.mjs adds this middleware under `astro dev` only.
 */
import type { MiddlewareHandler } from 'astro';

const KEEP_RESPONSE_HEADER = 'X-Astro-Reroute';

function isEditorPage(pathname: string): boolean {
  return pathname === '/editor' || pathname.startsWith('/editor/');
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  if (!isEditorPage(context.url.pathname)) {
    return response;
  }

  response.headers.set(KEEP_RESPONSE_HEADER, 'no');
  return response;
};
