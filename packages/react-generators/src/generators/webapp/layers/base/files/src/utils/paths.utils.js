import appConfig from "@app-config";

/** A path inside the app's base route: `appPath("/overview")` → `/client/overview`. */
export const appPath = (path = "") => `${appConfig.basePath}${path.startsWith("/") || !path ? path : `/${path}`}`;

/** A URL under the deployment's base path: a file in public/ or a full-page link outside the router. */
export const publicUrl = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;

/** An app route from the site's root, for links that leave the router (copy a link, open a new tab). */
export const appUrl = (path) => publicUrl(appPath(path));

/** Whether `pathname` is `to` or under it. */
export const isUnder = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);
