import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';

import { toPosix } from '../tree/paths.js';

const TEMPLATE_SUFFIX = '.ejs';
const RENAMES = Object.freeze({ _gitignore: '.gitignore', _npmrc: '.npmrc', _prettierrc: '.prettierrc' });
const PATH_TOKEN = /__([a-zA-Z][a-zA-Z0-9]*)__/g;

const walk = (directory, base = directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath, base);
    }

    return [toPosix(path.relative(base, fullPath))];
  });

const renderPath = (relativePath, data) => {
  const segments = relativePath.split('/').map((segment) => {
    const renamed = RENAMES[segment] || segment;
    return renamed.replace(PATH_TOKEN, (match, name) => {
      if (data[name] === undefined) {
        throw new Error(`Template path token ${match} has no value`);
      }

      return String(data[name]);
    });
  });

  const joined = segments.join('/');
  return joined.endsWith(TEMPLATE_SUFFIX) ? joined.slice(0, -TEMPLATE_SUFFIX.length) : joined;
};

/**
 * Renders a template folder into `{ path, content }` entries. Files without the `.ejs` suffix are copied as-is
 * (they stay valid source code in the template), `.ejs` files are rendered with `data`, and `__name__` tokens in
 * paths are replaced by `data.name`.
 */
export const renderDirectory = (sourceDir, data = {}) =>
  walk(sourceDir).map((relativePath) => {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = renderPath(relativePath, data);
    if (!relativePath.endsWith(TEMPLATE_SUFFIX)) {
      return { path: targetPath, content: fs.readFileSync(sourcePath) };
    }

    const template = fs.readFileSync(sourcePath, 'utf8');
    return { path: targetPath, content: ejs.render(template, data, { filename: sourcePath }) };
  });

export const listFiles = (directory) => walk(directory);

/** Renders one EJS template string with `data` (a generator that picks its template at run time). */
export const renderTemplate = (template, data = {}, filename = undefined) => ejs.render(template, data, { filename });
