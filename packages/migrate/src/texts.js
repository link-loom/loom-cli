import MagicString from 'magic-string';

import { parseSource, walkAst } from '@link-loom/devkit';

// Attributes people read: their literal values are copy too.
const BUTTON_TEXTS = [
  'confirmText',
  'cancelText',
  'confirmLabel',
  'cancelLabel',
  'confirmButtonText',
  'cancelButtonText',
  'buttonText',
  'okText',
];
const TEXT_ATTRIBUTES = new Set([
  'alt',
  'title',
  'placeholder',
  'aria-label',
  'label',
  'helperText',
  'description',
  'tooltip',
  'subtitle',
  ...BUTTON_TEXTS,
]);
// Keys of object literals whose values people read: columns, tabs, tiles, menu entries.
const TEXT_KEYS = new Set([
  'label',
  'title',
  'headerName',
  'description',
  'subtitle',
  'placeholder',
  'helperText',
  'tooltip',
  'caption',
  'emptyText',
  ...BUTTON_TEXTS,
]);
// A text people read has a word in it, and is not a colour, a path or an address.
const NOT_PROSE = /^(#[0-9a-f]{3,8}|\/[\w/:.-]*|https?:\/\/\S+)$/i;
const HAS_LETTER = { test: (text) => /\p{L}{2,}/u.test(text) && !NOT_PROSE.test(text.trim()) };
// Calls whose first argument is a text people read: the page title and the notices.
const TEXT_CALLS = new Set(['setPageName', 'openSnackbar', 'enqueueSnackbar', 'showSnackbar', 'toast']);

const lineOf = (source, index) => source.slice(0, index).split('\n').length;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** `copy.a.b`, or `copy.a["3d"]` for a segment that is not an identifier. */
const accessorOf = (key) =>
  `copy${key
    .split('.')
    .map((segment) => (IDENTIFIER.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`))
    .join('')}`;

/** The text of a string literal, or of a template literal without expressions; null for anything else. */
const literalText = (node) => {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  return null;
};

/** The fixed texts an expression can end in: itself, or the branches of `a ? "x" : "y"` and `a && "x"`. */
const literalLeaves = (node) => {
  if (literalText(node) !== null) return [node];
  if (node?.type === 'ConditionalExpression')
    return [...literalLeaves(node.consequent), ...literalLeaves(node.alternate)];
  if (node?.type === 'LogicalExpression') return [...literalLeaves(node.left), ...literalLeaves(node.right)];
  return [];
};

const keyName = (property) =>
  property.computed
    ? null
    : (property.key?.name ?? (property.key?.type === 'StringLiteral' ? property.key.value : null));

/**
 * Every text a component writes for people: JSX text and literals, the literal values of the attributes people read,
 * the values of object keys people read (labels, titles, column headers) and the first argument of the calls that show
 * one (the page title, notices). Each one with its position, so the same text can be rewritten later to read from the
 * dictionaries.
 */
export const findTexts = (source, file = 'file.jsx') => {
  const ast = parseSource(source, file);
  if (!ast) {
    return [];
  }

  const texts = [];
  const add = (kind, text, node, extra = {}) =>
    texts.push({ kind, text, start: node.start, end: node.end, line: lineOf(source, node.start), ...extra });
  walkAst(ast, (node, parent) => {
    if (node.type === 'JSXText' && HAS_LETTER.test(node.value)) {
      const text = node.value.replace(/\s+/g, ' ').trim();
      const start = node.start + node.value.indexOf(node.value.trim());
      texts.push({ kind: 'text', text, start, end: start + node.value.trim().length, line: lineOf(source, start) });
      return;
    }

    const call = node.type === 'CallExpression' && (node.callee?.name ?? node.callee?.property?.name);
    if (call && TEXT_CALLS.has(call)) {
      for (const leaf of literalLeaves(node.arguments[0])) {
        if (HAS_LETTER.test(literalText(leaf))) add('call', literalText(leaf), leaf, { call });
      }
      return;
    }

    if (node.type === 'JSXAttribute' && TEXT_ATTRIBUTES.has(node.name?.name)) {
      if (node.value?.type === 'StringLiteral' && HAS_LETTER.test(node.value.value)) {
        add('attribute', node.value.value, node.value, { attribute: node.name.name });
        return;
      }

      for (const leaf of literalLeaves(node.value?.expression)) {
        if (HAS_LETTER.test(literalText(leaf)))
          add('expression', literalText(leaf), leaf, { attribute: node.name.name });
      }
      return;
    }

    if (node.type === 'JSXExpressionContainer' && ['JSXElement', 'JSXFragment'].includes(parent?.type)) {
      for (const leaf of literalLeaves(node.expression)) {
        const text = literalText(leaf);
        if (HAS_LETTER.test(text)) add('expression', text.replace(/\s+/g, ' ').trim(), leaf);
      }
      return;
    }

    if (node.type === 'ObjectProperty' && TEXT_KEYS.has(keyName(node))) {
      for (const leaf of literalLeaves(node.value)) {
        if (!HAS_LETTER.test(literalText(leaf))) continue;
        add('property', literalText(leaf), leaf, {
          property: keyName(node),
          // Only a label that is the whole value can become a getter.
          ...(leaf === node.value
            ? {
                propertyStart: node.start,
                propertyEnd: node.end,
                keySource: source.slice(node.key.start, node.key.end),
              }
            : {}),
        });
      }
    }
  });
  return texts;
};

const FUNCTIONS = new Set([
  'FunctionDeclaration',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassMethod',
  'ObjectMethod',
]);

/** Every function of the module with its name; components (`Name`) and hooks (`useName`) can call `useCopy`. */
const functionsOf = (ast) => {
  const found = [];
  walkAst(ast, (node, parent) => {
    if (!FUNCTIONS.has(node.type)) return;
    const name =
      node.id?.name ||
      node.key?.name ||
      (parent?.type === 'VariableDeclarator' ? parent.id?.name : undefined) ||
      (parent?.type === 'AssignmentExpression' ? parent.left?.property?.name : undefined) ||
      '';
    const isClassMember = node.type === 'ClassMethod' || node.type === 'ObjectMethod';
    const wrapper = parent?.type === 'CallExpression' && (parent.callee?.name ?? parent.callee?.property?.name);
    const isComponent =
      /^([A-Z]|use[A-Z])/.test(name) ||
      ['memo', 'forwardRef'].includes(wrapper) ||
      parent?.type === 'ExportDefaultDeclaration';
    found.push({ node, hooks: !isClassMember && isComponent });
  });
  return found;
};

const usesName = (node, name) => {
  let found = false;
  walkAst(node, (inner) => {
    if (inner.type === 'Identifier' && inner.name === name) found = true;
  });
  return found;
};

/** Declares `const copy = <reader>();` first thing in a function; an arrow with an expression body gets a block. */
const declareCopy = (edited, fn, reader) => {
  const statement = `const copy = ${reader}();`;
  if (fn.body.type === 'BlockStatement') {
    edited.appendLeft(fn.body.start + 1, `\n  ${statement}`);
    return;
  }

  const bodyStart = fn.body.extra?.parenthesized ? fn.body.extra.parenStart : fn.body.start;
  edited.appendLeft(bodyStart, `{\n  ${statement}\n  return `);
  edited.appendLeft(fn.end, ';\n}');
};

/** Adds names to the module's import from `from`, or a new import after the last one. */
const importNames = (edited, ast, names, from) => {
  const imports = ast.program.body.filter((statement) => statement.type === 'ImportDeclaration');
  const existing = imports.find((statement) => statement.source.value === from);
  const missing = names.filter((name) => !existing?.specifiers.some((specifier) => specifier.local.name === name));
  if (!missing.length) return;
  const named = existing?.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier') || [];
  if (named.length) {
    edited.appendLeft(named.at(-1).end, `, ${missing.join(', ')}`);
    return;
  }

  const statement = `import { ${missing.join(', ')} } from "${from}";`;
  if (imports.length) {
    edited.appendLeft(imports.at(-1).end, `\n${statement}`);
    return;
  }

  edited.prepend(`${statement}\n\n`);
};

/**
 * Rewrites the texts the decisions gave a key to so they read from the dictionaries (`keys` maps a text's start
 * offset to its dotted key). Inside a component or a hook, `copy` comes from `useCopy()`, declared at the top of the
 * innermost one; inside any other function, from `getCopy()`, declared at the top of the outermost one. The label of a
 * module-level object becomes a getter that calls `getCopy()`. Any other text outside every function, or in a function
 * that already has a `copy` of its own, stays as it is and comes back in `left`.
 */
export const readTextsFromCopy = (source, keys, { file = 'file.jsx', importFrom = '@i18n/index' } = {}) => {
  const texts = findTexts(source, file).filter((text) => keys[text.start]);
  if (!texts.length) {
    return { source, rewritten: [], left: [] };
  }

  const ast = parseSource(source, file);
  const functions = functionsOf(ast);
  const edited = new MagicString(source);
  const readers = new Map();
  const rewritten = [];
  const left = [];
  let getters = false;
  for (const text of texts) {
    const accessor = accessorOf(keys[text.start]);
    const enclosing = functions.filter(({ node }) => text.start > node.start && text.end <= node.end);
    const host = enclosing.filter((fn) => fn.hooks).at(-1) || enclosing[0];
    // A label of a module-level object (columns, tabs): a getter reads the active locale when the label is used.
    if (!host && text.kind === 'property' && text.propertyStart !== undefined) {
      edited.overwrite(
        text.propertyStart,
        text.propertyEnd,
        `get ${text.keySource}() {\n    return ${accessor.replace(/^copy/, 'getCopy()')};\n  }`,
      );
      getters = true;
      rewritten.push(text.start);
      continue;
    }

    if (!host || (!readers.has(host.node) && usesName(host.node, 'copy'))) {
      left.push(text);
      continue;
    }

    readers.set(host.node, host.hooks ? 'useCopy' : 'getCopy');
    edited.overwrite(text.start, text.end, ['text', 'attribute'].includes(text.kind) ? `{${accessor}}` : accessor);
    rewritten.push(text.start);
  }

  for (const [fn, reader] of readers) declareCopy(edited, fn, reader);
  const names = new Set([...readers.values(), ...(getters ? ['getCopy'] : [])]);
  importNames(edited, ast, [...names].sort(), importFrom);
  return { source: edited.toString(), rewritten, left };
};
