const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Deep merge of copy trees: later layers add keys; a key two layers both define is a template bug. */
export const mergeDictionaries = (trees, at = '') =>
  trees.reduce((merged, tree) => {
    for (const [key, value] of Object.entries(tree || {})) {
      const path = at ? `${at}.${key}` : key;
      if (isPlainObject(value) && isPlainObject(merged[key])) {
        merged[key] = mergeDictionaries([merged[key], value], path);
        continue;
      }

      if (key in merged) {
        throw new Error(`Two layers define the copy key ${path}`);
      }

      merged[key] = value;
    }

    return merged;
  }, {});

/** Replaces `{name}`-style tokens in every string of a copy tree. */
export const fillTokens = (tree, tokens) =>
  Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      isPlainObject(value)
        ? fillTokens(value, tokens)
        : String(value).replace(/\{(\w+)\}/g, (match, token) => (token in tokens ? tokens[token] : match)),
    ]),
  );

const literal = (value, depth) => {
  if (!isPlainObject(value)) {
    return JSON.stringify(value);
  }

  const indent = '  '.repeat(depth + 1);
  const lines = Object.entries(value).map(
    ([key, child]) => `${indent}${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${literal(child, depth + 1)},`,
  );
  return `{\n${lines.join('\n')}\n${'  '.repeat(depth)}}`;
};

/** A copy tree as the source of `src/i18n/<locale>.js`. */
export const dictionaryModule = (locale, tree, header) =>
  `${header}\nconst ${locale} = ${literal(tree, 0)};\n\nexport default ${locale};\n`;
