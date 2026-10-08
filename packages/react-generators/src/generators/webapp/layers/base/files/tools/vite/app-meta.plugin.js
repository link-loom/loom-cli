import appConfig from "../../src/app.config.js";
import { THEME_COLORS } from "../../src/constants/theme.js";
import en from "../../src/i18n/en.js";
import es from "../../src/i18n/es.js";

const DICTIONARIES = { en, es };
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

const LOADER_STYLE = `
  #app-loader { position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 1.5rem; background: #f7f8fa; transition: opacity 0.45s ease; }
  #app-loader.app-loader--hidden { opacity: 0; pointer-events: none; }
  #app-loader .app-loader__mark { width: 190px; height: auto; animation: app-loader-breathe 2s ease-in-out infinite; }
  #app-loader .app-loader__text { font: 600 11px/1 "Inter", system-ui, sans-serif; letter-spacing: 0.08em;
    text-transform: uppercase; color: #8b95a7; }
  @keyframes app-loader-breathe { 0%, 100% { opacity: 0.45; transform: scale(0.985); } 50% { opacity: 1; transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { #app-loader .app-loader__mark { animation: none; opacity: 1; } }
`;

const head = (tag, attrs, children) => ({ tag, attrs, children, injectTo: "head" });
const body = (tag, attrs, children) => ({ tag, attrs, children, injectTo: "body-prepend" });

// The label is resolved from the same storage key the app saves the language under: the loader shows before
// any of the app runs.
const loaderLabelScript = () => {
  const labels = Object.fromEntries(Object.entries(DICTIONARIES).map(([locale, copy]) => [locale, copy.common.loading]));
  const storageKey = `${appConfig.storageKey}:locale`;

  return `(function () {
  var labels = ${JSON.stringify(labels)};
  var locale = ${JSON.stringify(appConfig.defaultLocale)};
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(storageKey)});
    if (stored && labels[stored]) locale = stored;
  } catch (error) {}
  document.documentElement.lang = locale;
  document.getElementById("app-loader-text").textContent = labels[locale];
})();`;
};

/**
 * Writes the app's own text and brand into index.html, from src/app.config.js and the dictionaries: title,
 * description, favicons, manifest, share tags and the boot loader. index.html itself carries no copy.
 */
export function appMetaPlugin() {
  let base = "/";
  const asset = (file) => `${base}${file.replace(/^\//, "")}`;

  return {
    name: "link-loom:app-meta",
    configResolved(config) {
      base = config.base.endsWith("/") ? config.base : `${config.base}/`;
    },
    transformIndexHtml() {
      const copy = DICTIONARIES[appConfig.defaultLocale];

      return [
        head("title", {}, copy.app.title),
        head("meta", { name: "description", content: copy.app.description }),
        head("meta", { name: "theme-color", content: THEME_COLORS.header }),
        head("link", { rel: "icon", type: "image/svg+xml", href: asset(appConfig.brand.favicon) }),
        head("link", { rel: "icon", href: asset(appConfig.brand.faviconIco), sizes: "any" }),
        head("link", { rel: "apple-touch-icon", href: asset(appConfig.brand.appleTouchIcon) }),
        head("link", { rel: "manifest", href: asset("site.webmanifest") }),
        head("meta", { property: "og:type", content: "website" }),
        head("meta", { property: "og:title", content: copy.app.title }),
        head("meta", { property: "og:description", content: copy.app.description }),
        head("meta", { property: "og:image", content: asset(appConfig.seo.ogImage) }),
        head("meta", { name: "twitter:card", content: "summary_large_image" }),
        head("meta", { name: "robots", content: appConfig.seo.robots }),
        head("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
        head("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true }),
        head("link", { rel: "stylesheet", href: FONTS_URL }),
        head("style", {}, LOADER_STYLE),
        body("noscript", {}, copy.common.noScript),
        body("div", { id: "app-loader", "aria-hidden": "true" }, [
          { tag: "img", attrs: { class: "app-loader__mark", src: asset(appConfig.brand.logo), alt: "" } },
          { tag: "div", attrs: { class: "app-loader__text", id: "app-loader-text" } },
        ]),
        body("script", {}, loaderLabelScript()),
      ];
    },
  };
}
