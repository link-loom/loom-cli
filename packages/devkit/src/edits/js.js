import { parse } from '@babel/parser';
import MagicString from 'magic-string';

import { ERROR_CODES, LoomError } from '../errors.js';
import { parserPluginsFor } from '../check/ast.js';
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const shapeError = (file, message, manual) =>
  new LoomError(ERROR_CODES.editShape, `${file}: ${message}`, { path: file, ...(manual ? { manual } : {}) });

const parseModule = (source, file) => {
  try {
    return parse(source, { sourceType: 'module', plugins: parserPluginsFor(file) });
  } catch (error) {
    throw shapeError(file, `cannot be parsed (${error.message})`);
  }
};

const declaratorsOf = (statement) => {
  const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
  return declaration?.type === 'VariableDeclaration' ? declaration.declarations : [];
};

/** The initial value of `const <name> = …`, exported or not (a default export usually names its constant). */
const findValue = (ast, name, file) => {
  const declarator = ast.program.body.flatMap(declaratorsOf).find((candidate) => candidate.id?.name === name);
  if (!declarator?.init) {
    throw shapeError(
      file,
      `has no \`const ${name} = …\``,
      `Declare \`const ${name}\` again, or make the change by hand.`,
    );
  }

  return declarator.init;
};

const TYPE_WRAPPERS = Object.freeze(['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);

/** Unwraps `Object.freeze({…})`, `{…} as const` and `{…} satisfies T` to the literal the registry keeps. */
const literalOf = (node) => {
  if (TYPE_WRAPPERS.includes(node.type)) {
    return literalOf(node.expression);
  }

  return node.type === 'CallExpression' && node.arguments.length === 1 ? node.arguments[0] : node;
};

const keyName = (property) => property.key?.name ?? property.key?.value;

const indentAt = (source, position) => {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1;
  return /^\s*/.exec(source.slice(lineStart))[0];
};

/** The indentation of the elements of a literal, or one level deeper than the literal when it is empty. */
const childIndent = (source, node, children) =>
  children.length ? indentAt(source, children[0].start) : `${indentAt(source, node.start)}  `;

/** Inserts `entry` after the last element of a literal, after its trailing comma when it has one. */
const insertAfterLast = (edited, source, last, closingIndex, indent, entry) => {
  const comma = source.indexOf(',', last.end);
  if (comma !== -1 && comma < closingIndex) {
    edited.appendLeft(comma + 1, `\n${indent}${entry},`);
    return;
  }

  edited.appendLeft(last.end, `,\n${indent}${entry}`);
};

/** The quote the module already writes its strings with: `'` when its first string literal uses it, `"` otherwise. */
const quoteOf = (source, ast) => {
  let quote = '"';
  const visit = (node) => {
    if (!node || typeof node.type !== 'string' || quote !== '"') {
      return quote === '"';
    }

    if (node.type === 'StringLiteral') {
      quote = source[node.start] === "'" ? "'" : '"';
      return false;
    }

    return Object.entries(node).every(([key, value]) => {
      if (key === 'loc' || !value || typeof value !== 'object') {
        return true;
      }

      return Array.isArray(value) ? value.every((child) => visit(child)) : visit(value);
    });
  };
  visit(ast.program);
  return quote;
};

const stringText = (value, quote) =>
  quote === "'"
    ? `'${JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`
    : JSON.stringify(value);

const asKey = (key, quote = '"') => (IDENTIFIER.test(key) ? key : stringText(key, quote));

/** Replaces the value of `const <name> = …` with `value` (source text). */
export const replaceValue = (source, { name, value, file = 'file' }) => {
  const node = findValue(parseModule(source, file), name, file);
  const edited = new MagicString(source);
  edited.overwrite(node.start, node.end, value);
  return edited.toString();
};

/** Adds `key: [element]` at the end of an object literal: the first entry of a list the object did not have yet. */
const addArrayProperty = (source, object, key, element) => {
  const edited = new MagicString(source);
  const indent = childIndent(source, object, object.properties);
  const entry = `${asKey(key)}: [\n${indent}  ${element},\n${indent}]`;
  const last = object.properties.at(-1);
  if (!last) {
    edited.overwrite(object.start, object.end, `{\n${indent}${entry},\n${indentAt(source, object.start)}}`);
    return edited.toString();
  }

  insertAfterLast(edited, source, last, object.end - 1, indent, entry);
  return edited.toString();
};

const idOf = (item) =>
  item?.type === 'ObjectExpression'
    ? item.properties.find((property) => keyName(property) === 'id')?.value?.value
    : undefined;

/** Inserts `entry` before `target`: on its own line when the target starts one, inline otherwise. */
const insertBefore = (edited, source, target, entry) => {
  const lineStart = source.lastIndexOf('\n', target.start - 1) + 1;
  const leading = source.slice(lineStart, target.start);
  if (/^\s*$/.test(leading)) {
    edited.appendLeft(lineStart, `${leading}${entry},\n`);
    return;
  }

  edited.appendLeft(target.start, `${entry}, `);
};

/**
 * Appends `element` (source text) to the array literal of `const <name> = […]`, or puts it just before the element
 * whose `id` is `before` when there is one. With `id`, an element whose `id` property already has that value is a
 * conflict (E_TARGET_EXISTS), so a generator never adds the same entry twice. `path` reaches a nested array: object
 * keys, and inside a list the id of an entry (`['company', 'links']` in a list of footer columns).
 */
export const appendToArray = (source, { name, path = [], element, id, before, file = 'file' }) => {
  let array = literalOf(findValue(parseModule(source, file), name, file));
  for (const [index, key] of path.entries()) {
    // Inside a list of entries, a path step names the entry by its id (FOOTER_COLUMNS → "company" → links).
    if (array.type === 'ArrayExpression') {
      const entry = array.elements.find((item) => idOf(item) === key);
      if (!entry) {
        throw shapeError(
          file,
          `\`${name}\` has no entry with id "${key}"`,
          `Add the entry to \`${name}\` by hand: ${element}`,
        );
      }

      array = entry;
      continue;
    }

    const property = array.type === 'ObjectExpression' ? findProperty(array, key) : null;
    const isLast = index === path.length - 1;
    if (!property && isLast && array.type === 'ObjectExpression') {
      return addArrayProperty(source, array, key, element);
    }

    if (!property) {
      throw shapeError(file, `\`${name}.${path.join('.')}\` has no object at "${key}"`);
    }

    array = property.value;
  }

  if (array.type !== 'ArrayExpression') {
    const at = [name, ...path].join('.');
    throw shapeError(file, `\`${at}\` is not an array literal`, `Add the entry to \`${at}\` by hand: ${element}`);
  }

  if (id !== undefined && array.elements.some((item) => idOf(item) === id)) {
    throw new LoomError(ERROR_CODES.targetExists, `${file}: \`${name}\` already has an entry with id "${id}"`, {
      path: file,
      id,
    });
  }

  const indent = childIndent(source, array, array.elements);
  const closing = indentAt(source, array.end - 1);
  const last = array.elements.at(-1);
  const edited = new MagicString(source);
  const anchor = before === undefined ? null : array.elements.find((item) => idOf(item) === before);

  if (anchor) {
    insertBefore(edited, source, anchor, element);
    return edited.toString();
  }

  if (!last) {
    edited.overwrite(array.start, array.end, `[\n${indent}${element},\n${closing}]`);
    return edited.toString();
  }

  insertAfterLast(edited, source, last, array.end - 1, indent, element);
  return edited.toString();
};

const findProperty = (object, key) =>
  object.properties.find((property) => property.type === 'ObjectProperty' && keyName(property) === key);

const literalText = (value, indent, quote = '"') => {
  if (typeof value === 'string') {
    return stringText(value, quote);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => literalText(item, indent, quote)).join(', ')}]`;
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const inner = `${indent}  `;
  const lines = Object.entries(value).map(
    ([key, child]) => `${inner}${asKey(key, quote)}: ${literalText(child, inner, quote)},`,
  );
  return `{\n${lines.join('\n')}\n${indent}}`;
};

/** Adds `key: value` at the end of an object literal, keeping its indentation and trailing commas. */
const addProperty = (edited, source, object, key, value, quote) => {
  const indent = childIndent(source, object, object.properties);
  const entry = `${asKey(key, quote)}: ${literalText(value, indent, quote)}`;
  const last = object.properties.at(-1);
  if (!last) {
    edited.overwrite(object.start, object.end, `{\n${indent}${entry},\n${indentAt(source, object.start)}}`);
    return;
  }

  insertAfterLast(edited, source, last, object.end - 1, indent, entry);
};

/**
 * Sets the property at `path` of the object literal `const <name> = {…}` to the JSON-safe `value`: an existing
 * property is overwritten, a missing one is added at the end of its parent. Every parent must already exist.
 */
export const setProperty = (source, { name, path, value, file = 'file' }) => {
  const ast = parseModule(source, file);
  const quote = quoteOf(source, ast);
  let object = literalOf(findValue(ast, name, file));
  for (const key of path.slice(0, -1)) {
    const property = object.type === 'ObjectExpression' ? findProperty(object, key) : null;
    if (!property || property.value.type !== 'ObjectExpression') {
      throw shapeError(file, `\`${name}.${path.join('.')}\` has no object at "${key}"`);
    }

    object = property.value;
  }

  const key = path.at(-1);
  const edited = new MagicString(source);
  const property = findProperty(object, key);
  if (property) {
    edited.overwrite(
      property.value.start,
      property.value.end,
      literalText(value, indentAt(source, property.start), quote),
    );
    return edited.toString();
  }

  addProperty(edited, source, object, key, value, quote);
  return edited.toString();
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const addMissing = (edited, source, object, tree, at, conflicts, quote) => {
  for (const [key, value] of Object.entries(tree)) {
    const property = findProperty(object, key);
    if (!property) {
      addProperty(edited, source, object, key, value, quote);
      continue;
    }

    const isNested = isPlainObject(value) && property.value.type === 'ObjectExpression';
    if (isNested) {
      addMissing(edited, source, property.value, value, `${at}${key}.`, conflicts, quote);
      continue;
    }

    conflicts.push(`${at}${key}`);
  }
};

/**
 * Adds every key of `tree` that `const <name> = {…}` lacks, nested objects included: how a generator adds copy to a
 * dictionary. A key that already exists is left alone and reported in `conflicts`.
 */
export const addMissingProperties = (source, { name, tree, file = 'file' }) => {
  const ast = parseModule(source, file);
  const object = literalOf(findValue(ast, name, file));
  if (object.type !== 'ObjectExpression') {
    throw shapeError(file, `\`${name}\` is not an object literal`);
  }

  const edited = new MagicString(source);
  const conflicts = [];
  addMissing(edited, source, object, tree, '', conflicts, quoteOf(source, ast));
  return { source: edited.toString(), conflicts };
};

/**
 * Adds every key of `entries` that `const <name> = {…}` lacks, each with its value as source text (an identifier, a
 * call): how a generator registers an icon or a component by key. Existing keys are left alone and reported.
 */
export const addEntries = (source, { name, entries, file = 'file' }) => {
  const object = literalOf(findValue(parseModule(source, file), name, file));
  if (object.type !== 'ObjectExpression') {
    throw shapeError(file, `\`${name}\` is not an object literal`);
  }

  const conflicts = Object.keys(entries).filter((key) => findProperty(object, key));
  const lines = Object.entries(entries)
    .filter(([key]) => !conflicts.includes(key))
    .map(([key, value]) => `${asKey(key)}: ${value}`);
  const edited = new MagicString(source);
  const indent = childIndent(source, object, object.properties);
  const last = object.properties.at(-1);
  if (lines.length && !last) {
    const body = lines.map((line) => `${indent}${line},`).join('\n');
    edited.overwrite(object.start, object.end, `{\n${body}\n${indentAt(source, object.start)}}`);
  }

  if (lines.length && last) {
    lines.forEach((line) => insertAfterLast(edited, source, last, object.end - 1, indent, line));
  }

  return { source: edited.toString(), conflicts };
};

const importsOf = (ast) => ast.program.body.filter((statement) => statement.type === 'ImportDeclaration');

/**
 * Makes `source` import `named` (and `defaultName`) from `from`: missing names join the import that already reads
 * that module, or a new import goes after the last one. Names already imported are left as they are.
 */
export const addImport = (source, { from, named = [], defaultName, file = 'file' }) => {
  const ast = parseModule(source, file);
  const quote = quoteOf(source, ast);
  const imports = importsOf(ast);
  const existing = imports.find((statement) => statement.source.value === from && statement.importKind !== 'type');
  const edited = new MagicString(source);

  if (!existing) {
    const parts = [defaultName, named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean);
    const statement = parts.length
      ? `import ${parts.join(', ')} from ${stringText(from, quote)};`
      : `import ${stringText(from, quote)};`;
    const last = imports.at(-1);
    if (last) {
      edited.appendLeft(last.end, `\n${statement}`);
    } else {
      edited.prepend(`${statement}\n\n`);
    }

    return edited.toString();
  }

  const specifiers = existing.specifiers;
  const hasDefault = specifiers.some((specifier) => specifier.type === 'ImportDefaultSpecifier');
  if (defaultName && !hasDefault) {
    throw shapeError(
      file,
      `already imports "${from}" without a default`,
      `Import ${defaultName} from "${from}" by hand.`,
    );
  }

  const importedNames = new Set(
    specifiers
      .filter((specifier) => specifier.type === 'ImportSpecifier')
      .map((specifier) => specifier.imported.name ?? specifier.imported.value),
  );
  const missing = named.filter((importName) => !importedNames.has(importName));
  if (!missing.length) {
    return source;
  }

  const namedSpecifiers = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
  const last = namedSpecifiers.at(-1);
  if (!last) {
    const anchor = specifiers.at(-1);
    edited.appendLeft(anchor.end, `, { ${missing.join(', ')} }`);
    return edited.toString();
  }

  const closingBrace = source.indexOf('}', last.end);
  const multiline = source.slice(existing.start, closingBrace).includes('\n');
  const indent = multiline ? indentAt(source, last.start) : ' ';
  const joined = missing.map((importName) => (multiline ? `\n${indent}${importName},` : ` ${importName},`)).join('');
  const comma = source.indexOf(',', last.end);
  if (comma !== -1 && comma < closingBrace) {
    edited.appendLeft(comma + 1, joined);
    return edited.toString();
  }

  edited.appendLeft(last.end, `,${joined.replace(/,$/, '')}`);
  return edited.toString();
};

/** Removes the elements whose `id` is `id` from `const <name> = […]`, with their trailing comma and their line. */
export const removeFromArray = (source, { name, id, file = 'file' }) => {
  const array = literalOf(findValue(parseModule(source, file), name, file));
  if (array.type !== 'ArrayExpression') {
    throw shapeError(file, `\`${name}\` is not an array literal`);
  }

  const edited = new MagicString(source);
  for (const item of array.elements.filter((element) => idOf(element) === id)) {
    const lineStart = source.lastIndexOf('\n', item.start - 1) + 1;
    const ownLine = /^\s*$/.test(source.slice(lineStart, item.start));
    const comma = source.indexOf(',', item.end);
    const afterComma =
      comma !== -1 && comma < array.end - 1 && /^\s*$/.test(source.slice(item.end, comma)) ? comma + 1 : item.end;
    const lineEnd = source.indexOf('\n', afterComma);
    const end = ownLine && lineEnd !== -1 && /^\s*$/.test(source.slice(afterComma, lineEnd)) ? lineEnd + 1 : afterComma;
    edited.remove(ownLine ? lineStart : item.start, end);
  }

  return edited.toString();
};

/** Removes `import … from "<from>"` when none of the names it brings is used any more in the module. */
export const removeUnusedImport = (source, { from, file = 'file' }) => {
  const ast = parseModule(source, file);
  const statement = importsOf(ast).find((candidate) => candidate.source.value === from);
  if (!statement) {
    return source;
  }

  const rest = source.slice(0, statement.start) + source.slice(statement.end);
  const used = statement.specifiers.some((specifier) => new RegExp(`\\b${specifier.local.name}\\b`).test(rest));
  if (used) {
    return source;
  }

  const edited = new MagicString(source);
  const lineEnd = source.indexOf('\n', statement.end);
  edited.remove(statement.start, lineEnd === -1 ? statement.end : lineEnd + 1);
  return edited.toString();
};
