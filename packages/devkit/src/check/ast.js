import { parse } from '@babel/parser';

const TYPESCRIPT = /\.(ts|tsx|mts|cts)$/;

/** Babel plugins for a file: TypeScript for .ts (with JSX for .tsx), JSX for everything else. */
export const parserPluginsFor = (file = '') => {
  if (!TYPESCRIPT.test(file)) {
    return ['jsx'];
  }

  return file.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'];
};

/**
 * The AST of a module, or null when it cannot be parsed (a check then reports the file instead of crashing). `file`
 * picks the syntax: a .ts module is parsed as TypeScript.
 */
export const parseSource = (source, file) => {
  try {
    return parse(source, { sourceType: 'module', plugins: parserPluginsFor(file), errorRecovery: true });
  } catch {
    return null;
  }
};

/** Calls `visit(node, parent)` for every node of the tree, depth first. */
export const walkAst = (node, visit, parent = null) => {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((child) => walkAst(child, visit, node));
      continue;
    }

    if (value && typeof value.type === 'string') {
      walkAst(value, visit, node);
    }
  }
};

/** The names a module imports from `source`: `{ default, named: [imported names] }`. */
export const importsFrom = (ast, source) => {
  const found = { default: null, named: [] };
  for (const statement of ast?.program.body || []) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== source) {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        found.default = specifier.local.name;
      }

      if (specifier.type === 'ImportSpecifier') {
        found.named.push(specifier.imported.name ?? specifier.imported.value);
      }
    }
  }

  return found;
};

/** Every module the file imports from, with the line of each import. */
export const importSources = (ast) =>
  (ast?.program.body || [])
    .filter((statement) => statement.type === 'ImportDeclaration')
    .map((statement) => ({ source: statement.source.value, line: statement.loc.start.line }));
