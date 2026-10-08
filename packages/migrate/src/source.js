import fs from 'node:fs';
import path from 'node:path';

import { listProjectFiles, parseSource, toPosix, walkAst } from '@link-loom/devkit';

const SOURCE = /\.(js|jsx|ts|tsx|mjs)$/;
const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];

/** The aliases vite.config.js declares: `'@components': path.resolve(__dirname, './src/components')` and the like. */
const aliasesOf = (root) => {
  const file = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts']
    .map((name) => path.join(root, name))
    .find(fs.existsSync);
  if (!file) {
    return {};
  }

  const source = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    [...source.matchAll(/['"](@[\w-]*)['"]\s*:\s*[^\n]*?['"]\.?\/?(src\/[^'"]*)['"]/g)].map(([, alias, target]) => [
      alias,
      target.replace(/\/$/, ''),
    ]),
  );
};

/**
 * The legacy app as the migrator reads it: its files, a cached parser, and import resolution with its own Vite
 * aliases, so `@services`, `../../services/index` and `./x` all land on a file of src/.
 */
export const openRepo = (root) => {
  const files = listProjectFiles(root).filter((file) => !file.startsWith('public/'));
  const fileSet = new Set(files);
  const aliases = aliasesOf(root);
  const asts = new Map();
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const ast = (file) => {
    if (!asts.has(file)) asts.set(file, parseSource(read(file), file));
    return asts.get(file);
  };

  const resolve = (from, specifier) => {
    const alias = Object.keys(aliases)
      .sort((left, right) => right.length - left.length)
      .find((name) => specifier === name || specifier.startsWith(`${name}/`));
    let base;
    if (alias) {
      base = aliases[alias] + specifier.slice(alias.length);
    } else if (specifier.startsWith('.')) {
      base = toPosix(path.normalize(path.join(path.dirname(from), specifier)));
    } else {
      return null;
    }

    return EXTENSIONS.map((extension) => `${base}${extension}`).find((candidate) => fileSet.has(candidate)) || null;
  };

  /** Every static and dynamic import of a module, with the file it resolves to (null for packages). */
  const importsOf = (file) => {
    const found = [];
    const tree = SOURCE.test(file) ? ast(file) : null;
    walkAst(tree, (node) => {
      if (
        node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration'
      ) {
        if (node.source) {
          found.push({ node, specifier: node.source.value, target: resolve(file, node.source.value) });
        }
      }

      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Import' &&
        node.arguments[0]?.type === 'StringLiteral'
      ) {
        found.push({
          node,
          specifier: node.arguments[0].value,
          target: resolve(file, node.arguments[0].value),
          dynamic: true,
        });
      }
    });
    return found;
  };

  return {
    root,
    files,
    sources: files.filter((file) => file.startsWith('src/') && SOURCE.test(file)),
    aliases,
    read,
    ast,
    resolve,
    importsOf,
  };
};

/** The files reachable from `entries` through imports: what the app actually runs. */
export const reachableFrom = (repo, entries) => {
  const seen = new Set();
  const visit = (file) => {
    if (!file || seen.has(file)) return;
    seen.add(file);
    repo.importsOf(file).forEach((entry) => visit(entry.target));
  };
  entries.forEach(visit);
  return seen;
};
