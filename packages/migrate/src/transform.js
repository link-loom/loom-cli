import MagicString from 'magic-string';

import { parseSource, walkAst } from '@link-loom/devkit';

const ALIASES = Object.freeze([
  ['src/components/', '@components/'],
  ['src/pages/', '@pages/'],
  ['src/layouts/', '@layouts/'],
  ['src/routes/', '@routes/'],
  ['src/services/', '@services/'],
  ['src/hooks/', '@hooks/'],
  ['src/constants/', '@constants/'],
  ['src/i18n/', '@i18n/'],
  ['src/utils/', '@utils/'],
]);

/** How the new project imports one of its files: through its alias, without the extension. */
export const specifierOf = (file) => {
  const [folder, alias] = ALIASES.find(([prefix]) => file.startsWith(prefix)) || [];
  const bare = file.replace(/\.(jsx?|tsx?)$/, '');
  return folder ? `${alias}${bare.slice(folder.length)}` : `./${bare}`;
};

const removeStatement = (edited, source, node) => {
  const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
  const lineEnd = source.indexOf('\n', node.end);
  const onlyOnLine =
    source.slice(lineStart, node.start).trim() === '' &&
    source.slice(node.end, lineEnd === -1 ? undefined : lineEnd).trim() === '';
  if (onlyOnLine) {
    edited.remove(lineStart, lineEnd === -1 ? source.length : lineEnd + 1);
    return;
  }

  edited.remove(node.start, node.end);
};

/**
 * The legacy layout handed pages `{ setPageName, isAdmin }` through the router's outlet context; the new frame has
 * no outlet context. `setPageName(x)` becomes `usePageMeta({ title: x })` at the top of the component, `isAdmin`
 * keeps its legacy value (always true), and anything else the context gave is reported.
 */
export const rewriteOutletContext = (source, file) => {
  const ast = parseSource(source, file);
  if (!ast || !source.includes('useOutletContext')) {
    return { source, notes: [] };
  }

  const edited = new MagicString(source);
  const notes = [];
  let pageTitle = null;
  let insertAt = null;

  walkAst(ast, (node, parent) => {
    const isContext =
      node.type === 'VariableDeclarator' &&
      node.init?.type === 'CallExpression' &&
      node.init.callee?.name === 'useOutletContext';
    if (!isContext) return;
    const names =
      node.id.type === 'ObjectPattern'
        ? node.id.properties.map((property) => property.value?.name ?? property.key?.name)
        : [];
    const declaration = parent;
    const replacements = names
      .filter((name) => name !== 'setPageName')
      .map((name) => {
        if (name === 'isAdmin') return 'const isAdmin = true;';
        notes.push(`${file}: the outlet context gave \`${name}\`, which the new frame does not; it is undefined now`);
        return `const ${name} = undefined;`;
      });
    insertAt = declaration.start;
    edited.overwrite(declaration.start, declaration.end, replacements.join('\n  '));
    if (!replacements.length) removeStatement(edited, source, declaration);
  });

  // `useEffect(() => { setPageName(x); }, [])`: an effect that only named the page goes away with it.
  const onlyNamesThePage = (effect) => {
    const body = effect.arguments?.[0]?.body;
    return (
      effect.callee?.name === 'useEffect' &&
      body?.type === 'BlockStatement' &&
      body.body.length === 1 &&
      body.body[0].expression?.callee?.name === 'setPageName'
    );
  };
  walkAst(ast, (node) => {
    if (
      node.type === 'ExpressionStatement' &&
      node.expression?.type === 'CallExpression' &&
      onlyNamesThePage(node.expression)
    ) {
      const call = node.expression.arguments[0].body.body[0].expression;
      pageTitle = pageTitle ?? source.slice(call.arguments[0]?.start, call.arguments[0]?.end);
      removeStatement(edited, source, node);
      node.expression.arguments[0].body.body = [];
    }
  });
  walkAst(ast, (node, parent) => {
    if (node.type !== 'CallExpression' || node.callee?.name !== 'setPageName') return;
    pageTitle = pageTitle ?? source.slice(node.arguments[0]?.start, node.arguments[0]?.end);
    if (parent?.type === 'ExpressionStatement') removeStatement(edited, source, parent);
    else edited.overwrite(node.start, node.end, 'undefined');
  });

  if (pageTitle && insertAt !== null) {
    edited.appendLeft(insertAt, `usePageMeta({ title: ${pageTitle} });\n  `);
  }

  let result = edited.toString();
  result = result.replace(
    /(import\s*\{[^}]*?)\s*\buseOutletContext\b,?\s*([^}]*\}\s*from\s*['"]react-router-dom['"];?)/,
    (match, head, tail) => {
      const names = `${head} ${tail}`
        .replace(/import\s*\{|\}\s*from[\s\S]*/g, '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      return names.length ? `import { ${names.join(', ')} } from "react-router-dom";` : '';
    },
  );
  if (
    pageTitle &&
    !/\busePageMeta\b[^(]/.test(
      result
        .split('\n')
        .filter((line) => line.startsWith('import'))
        .join('\n'),
    )
  ) {
    result = /from\s+['"]@link-loom\/react-sdk['"]/.test(result)
      ? result.replace(
          /import\s*\{([^}]*)\}\s*from\s*(['"])@link-loom\/react-sdk\2;?/,
          (match, names, quote) =>
            `import { ${names.trim().replace(/,$/, '')}, usePageMeta } from ${quote}@link-loom/react-sdk${quote};`,
        )
      : `import { usePageMeta } from "@link-loom/react-sdk";\n${result}`;
  }

  return { source: result.replace(/^\s*\n/, ''), notes };
};

/**
 * Points every import of a moved file at its new place (through the project's aliases), opens barrels into one
 * import per name, and reports the imports of files that were not carried over.
 */
export const rewriteImports = (source, file, { targetOf, exportsDefault }) => {
  const ast = parseSource(source, file);
  if (!ast) return { source, notes: [`${file}: could not be parsed; imports left as they were`], missing: [] };
  const edited = new MagicString(source);
  const notes = [];
  const missing = [];

  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration' && !(statement.type === 'ExportNamedDeclaration' && statement.source))
      continue;
    const resolved = targetOf(statement.source.value);
    if (resolved === undefined) continue;
    if (resolved === null) {
      notes.push(`${file}: imports ${statement.source.value}, which was not carried over`);
      missing.push(
        ...(statement.specifiers || []).map((specifier) => ({
          name: specifier.local.name,
          from: statement.source.value,
        })),
      );
      continue;
    }

    if (typeof resolved === 'string') {
      edited.overwrite(statement.source.start, statement.source.end, `"${specifierOf(resolved)}"`);
      continue;
    }

    // A barrel: one import per name, from the file that defines it.
    const lines = (statement.specifiers || []).map((specifier) => {
      const name = specifier.imported?.name ?? specifier.local.name;
      const local = specifier.local.name;
      const target = resolved[name];
      if (!target) {
        notes.push(`${file}: ${name} came from a barrel and has no file of its own`);
        missing.push({ name: local, from: statement.source.value });
        return null;
      }

      return exportsDefault(target)
        ? `import ${local} from "${specifierOf(target)}";`
        : `import { ${name === local ? name : `${name} as ${local}`} } from "${specifierOf(target)}";`;
    });
    edited.overwrite(statement.start, statement.end, lines.filter(Boolean).join('\n'));
  }

  // Lazy imports: `import('./x/Y')`.
  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Import' || node.arguments[0]?.type !== 'StringLiteral')
      return;
    const resolved = targetOf(node.arguments[0].value);
    if (typeof resolved === 'string')
      edited.overwrite(node.arguments[0].start, node.arguments[0].end, `"${specifierOf(resolved)}"`);
  });

  return { source: edited.toString(), notes, missing };
};

const NOT_A_REFERENCE = [
  (node, parent) =>
    ['MemberExpression', 'OptionalMemberExpression', 'JSXMemberExpression'].includes(parent.type) &&
    parent.property === node &&
    !parent.computed,
  (node, parent) =>
    ['ObjectProperty', 'ObjectMethod', 'ClassMethod', 'ClassProperty'].includes(parent.type) &&
    parent.key === node &&
    !parent.computed &&
    !parent.shorthand,
  (node, parent) => parent.type.startsWith('Import') && parent.type.endsWith('Specifier'),
  (node, parent) => parent.type === 'JSXAttribute',
];

/** How many times each name is read in the module (imports and object keys aside). */
const referencesOf = (ast) => {
  const counts = new Map();
  walkAst(ast, (node, parent) => {
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') return;
    if (parent && NOT_A_REFERENCE.some((test) => test(node, parent))) return;
    counts.set(node.name, (counts.get(node.name) || 0) + 1);
  });
  return counts;
};

/** The names of `names` a module still reads (imports aside). */
export const namesRead = (source, file, names) => {
  const references = referencesOf(parseSource(source, file));
  return names.filter((name) => references.get(name));
};

const specifierText = (specifier) => {
  const local = specifier.local.name;
  if (specifier.type === 'ImportDefaultSpecifier') return local;
  if (specifier.type === 'ImportNamespaceSpecifier') return `* as ${local}`;
  const imported = specifier.imported.name ?? JSON.stringify(specifier.imported.value);
  return imported === local ? local : `${imported} as ${local}`;
};

/**
 * Drops what carried code no longer reads: imported names nobody uses (a whole import when none is left; `React`
 * stays) and the binding of a `catch` that ignores its error. Legacy code was not linted; the new project is.
 */
export const pruneUnused = (source, file) => {
  const ast = parseSource(source, file);
  if (!ast) return source;
  const edited = new MagicString(source);
  const references = referencesOf(ast);
  const isUnused = (specifier) => specifier.local.name !== 'React' && !references.get(specifier.local.name);

  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration' || !statement.specifiers.length) continue;
    const kept = statement.specifiers.filter((specifier) => !isUnused(specifier));
    if (kept.length === statement.specifiers.length) continue;
    if (!kept.length) {
      removeStatement(edited, source, statement);
      continue;
    }

    const head = kept.filter((specifier) => specifier.type !== 'ImportSpecifier').map(specifierText);
    const named = kept.filter((specifier) => specifier.type === 'ImportSpecifier').map(specifierText);
    const clause = [...head, ...(named.length ? [`{ ${named.join(', ')} }`] : [])].join(', ');
    const from = source.slice(statement.source.start, statement.source.end);
    edited.overwrite(statement.start, statement.end, `import ${clause} from ${from};`);
  }

  walkAst(ast, (node) => {
    if (node.type !== 'CatchClause' || node.param?.type !== 'Identifier') return;
    let read = false;
    walkAst(node.body, (inner) => {
      if (inner.type === 'Identifier' && inner.name === node.param.name) read = true;
    });
    if (!read) edited.overwrite(node.start, node.body.start, 'catch ');
  });

  return edited.toString();
};

// A key that ends with "/" covers every path under it; any other key, that path alone (with its ?query or #hash).
const leadsWith = (value, key) =>
  key.endsWith('/')
    ? value.startsWith(key)
    : value === key || value.startsWith(`${key}?`) || value.startsWith(`${key}#`);

/**
 * Points the app paths written in carried code at their new place: `links` maps a legacy path to the new one (a key
 * ending in "/" maps everything under it), and a string, or the head of a template, is rewritten by the longest key
 * that matches.
 */
export const rewriteLinks = (source, file, links = {}) => {
  const prefixes = Object.keys(links)
    .filter((prefix) => links[prefix])
    .sort((left, right) => right.length - left.length);
  const ast = prefixes.length ? parseSource(source, file) : null;
  if (!ast) return source;
  const edited = new MagicString(source);
  walkAst(ast, (node, parent) => {
    const isHead = node.type === 'TemplateElement' && parent?.quasis?.[0] === node;
    const value = node.type === 'StringLiteral' ? node.value : isHead ? node.value.raw : null;
    const prefix = value === null ? null : prefixes.find((candidate) => leadsWith(value, candidate));
    if (!prefix) return;
    const rewritten = `${links[prefix]}${value.slice(prefix.length)}`;
    if (node.type === 'StringLiteral') edited.overwrite(node.start + 1, node.end - 1, rewritten);
    else edited.overwrite(node.start, node.end, rewritten);
  });
  return edited.toString();
};
