/** A single-quoted JavaScript string literal, the quote style of every generated .ts and .astro file. */
export const quote = (value) =>
  `'${JSON.stringify(String(value ?? ''))
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")}'`;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const keyText = (key) => (IDENTIFIER.test(key) ? key : quote(key));

/** A value as TypeScript source with single quotes and two-space indentation. */
export const sourceOf = (value, indent = '') => {
  if (typeof value === 'string') {
    return quote(value);
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item !== 'object' || item === null)) {
      return `[${value.map((item) => sourceOf(item, inner)).join(', ')}]`;
    }

    return `[\n${value.map((item) => `${inner}${sourceOf(item, inner)},`).join('\n')}\n${indent}]`;
  }

  const entries = Object.entries(value);
  if (!entries.length) {
    return '{}';
  }

  return `{\n${entries.map(([key, child]) => `${inner}${keyText(key)}: ${sourceOf(child, inner)},`).join('\n')}\n${indent}}`;
};

/** Replaces `{token}` in every string of a copy tree; tokens it does not know (like `{year}`) stay for runtime. */
export const fillTokens = (value, tokens) => {
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (match, token) => (tokens[token] === undefined ? match : tokens[token]));
  }

  if (Array.isArray(value)) {
    return value.map((item) => fillTokens(item, tokens));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, fillTokens(child, tokens)]));
  }

  return value;
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Deep merge of copy trees; a later layer adds keys and never removes one. */
export const mergeCopy = (...trees) =>
  trees.reduce((merged, tree) => {
    for (const [key, value] of Object.entries(tree || {})) {
      merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? mergeCopy(merged[key], value) : value;
    }

    return merged;
  }, {});

const COPY_HEADERS = Object.freeze({
  en: 'Every text of the site in English. es.ts has exactly the same keys; `link-loom check` verifies it.',
  es: 'Todos los textos del sitio en español. en.ts tiene exactamente las mismas claves; `link-loom check` lo verifica.',
});

/** src/data/copy/<locale>.ts */
export const copyModule = (locale, copy) =>
  `/*\n * ${COPY_HEADERS[locale]}\n */\n\nexport const COPY = ${sourceOf(copy)};\n`;

export const camelCase = (value) =>
  String(value)
    .replace(/[-_/\s]+([a-z0-9])/gi, (_, letter) => letter.toUpperCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase());

export const pascalCase = (value) => {
  const camel = camelCase(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

export const slugify = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
