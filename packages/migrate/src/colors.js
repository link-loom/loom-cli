import MagicString from 'magic-string';

import { addEntries, parseSource, walkAst } from '@link-loom/devkit';

// The literals `link-loom check` calls colours: a lone #hex, or rgb()/rgba() with its arguments.
const COLOR = /(^|[^\w/&#-])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|rgba?\([^)]*\))/g;

export const LEGACY_COLORS = 'LEGACY_COLORS';

/** The token name of a colour literal: hex6b6577, rgba0002 (digits of its arguments). */
export const tokenOf = (color) =>
  color.startsWith('#')
    ? `hex${color.slice(1).toLowerCase()}`
    : `${color.startsWith('rgba') ? 'rgba' : 'rgb'}${color.replace(/[^0-9.]/g, '').replace(/\./g, '_')}`;

const quoteOf = (value) => JSON.stringify(value);

/**
 * Every colour literal of a module read from the theme instead: a string that is only a colour becomes
 * `LEGACY_COLORS.<token>`, and a string or template that mixes one in (`1px solid #ddd`) becomes a template that
 * interpolates it. Answers the rewritten source and the colours it took, to add to theme.js.
 */
export const colorsToTokens = (source, file) => {
  const ast = parseSource(source, file);
  if (!ast) return { source, colors: {} };
  const edited = new MagicString(source);
  const colors = {};
  const token = (color) => {
    const name = tokenOf(color);
    colors[name] = color;
    return `${LEGACY_COLORS}.${name}`;
  };

  walkAst(ast, (node, parent) => {
    if (node.type === 'StringLiteral' && parent?.type !== 'ImportDeclaration' && parent?.type !== 'JSXAttribute') {
      const matches = [...node.value.matchAll(COLOR)];
      if (!matches.length) return;
      if (matches.length === 1 && matches[0][2] === node.value.trim()) {
        edited.overwrite(node.start, node.end, token(matches[0][2]));
        return;
      }

      const template = node.value.replace(COLOR, (match, before, color) => `${before}\${${token(color)}}`);
      edited.overwrite(node.start, node.end, `\`${template.replace(/`/g, '\\`')}\``);
      return;
    }

    if (
      node.type === 'JSXAttribute' &&
      node.value?.type === 'StringLiteral' &&
      [...node.value.value.matchAll(COLOR)].length
    ) {
      const value = node.value.value;
      const matches = [...value.matchAll(COLOR)];
      const expression =
        matches.length === 1 && matches[0][2] === value.trim()
          ? token(matches[0][2])
          : `\`${value.replace(COLOR, (match, before, color) => `${before}\${${token(color)}}`)}\``;
      edited.overwrite(node.value.start, node.value.end, `{${expression}}`);
      return;
    }

    if (node.type === 'TemplateElement' && [...node.value.raw.matchAll(COLOR)].length) {
      edited.overwrite(
        node.start,
        node.end,
        node.value.raw.replace(COLOR, (match, before, color) => `${before}\${${token(color)}}`),
      );
    }
  });

  if (!Object.keys(colors).length) return { source, colors };
  let result = edited.toString();
  if (
    !new RegExp(`\\b${LEGACY_COLORS}\\b[^.]`).test(
      result
        .split('\n')
        .filter((line) => line.startsWith('import'))
        .join('\n'),
    )
  ) {
    const lastImport = ast.program.body.filter((statement) => statement.type === 'ImportDeclaration').at(-1);
    const statement = `import { ${LEGACY_COLORS} } from "@constants/theme";`;
    result = lastImport
      ? `${result.slice(0, lastImport.end)}\n${statement}${result.slice(lastImport.end)}`
      : `${statement}\n\n${result}`;
  }

  return { source: result, colors };
};

/** theme.js with `export const LEGACY_COLORS = { … }` holding every colour the carried code used. */
export const withLegacyColors = (theme, colors) => {
  if (!Object.keys(colors).length) return theme;
  const entries = Object.fromEntries(
    Object.entries(colors)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, color]) => [name, quoteOf(color)]),
  );
  if (!new RegExp(`export const ${LEGACY_COLORS}\\b`).test(theme)) {
    return `${theme.trimEnd()}\n\n// The colours the legacy code used outside its theme. Fold each into the palette, then delete it.\nexport const ${LEGACY_COLORS} = {};\n`.replace(
      `export const ${LEGACY_COLORS} = {};`,
      addEntries(`export const ${LEGACY_COLORS} = {};`, { name: LEGACY_COLORS, entries }).source,
    );
  }

  return addEntries(theme, { name: LEGACY_COLORS, entries }).source;
};
