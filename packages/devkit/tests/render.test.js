import { fileURLToPath } from 'node:url';

import { renderDirectory } from '../src/index.js';

const TEMPLATE = fileURLToPath(new URL('./fixtures/template', import.meta.url));

describe('renderDirectory', () => {
  it('renders .ejs files, replaces path tokens and renames dotfiles', () => {
    const files = Object.fromEntries(
      renderDirectory(TEMPLATE, { name: 'acme' }).map((file) => [file.path, file.content.toString()]),
    );

    expect(Object.keys(files).sort()).toEqual(['.gitignore', 'acme/index.js', 'static.txt']);
    expect(files['acme/index.js']).toBe('export const name = "acme";\n');
  });

  it('copies files without the .ejs suffix byte for byte', () => {
    const files = Object.fromEntries(
      renderDirectory(TEMPLATE, { name: 'acme' }).map((file) => [file.path, file.content.toString()]),
    );

    expect(files['static.txt']).toBe('static <%= untouched %>\n');
  });

  it('fails loudly when a path token has no value', () => {
    expect(() => renderDirectory(TEMPLATE, {})).toThrow('__name__');
  });
});
