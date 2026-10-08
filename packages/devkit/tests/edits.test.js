import { mergeJson, readDotenv, setDotenv, setJsonPath, stringifyJson } from '../src/index.js';

describe('JSON edits', () => {
  it('deep-merges objects and lets the overlay win on arrays and scalars', () => {
    const base = { name: 'a', scripts: { dev: 'vite' }, files: ['src'] };
    const overlay = { scripts: { test: 'jest' }, files: ['dist'] };

    expect(mergeJson(base, overlay)).toEqual({ name: 'a', scripts: { dev: 'vite', test: 'jest' }, files: ['dist'] });
  });

  it('sets a nested path without mutating the input', () => {
    const original = { packages: { '': { name: 'old' } } };
    const updated = setJsonPath(original, ['packages', '', 'name'], 'new');

    expect(updated.packages[''].name).toBe('new');
    expect(original.packages[''].name).toBe('old');
  });

  it('stringifies with two spaces and a final newline', () => {
    expect(stringifyJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe('dotenv edits', () => {
  it('replaces existing keys in place, keeps comments and appends new keys', () => {
    const text = '# backend\nVITE_APP_BACKEND_URL=http://old\n\nVITE_PORT=3000\n';

    const updated = setDotenv(text, { VITE_PORT: 4000, VITE_NEW: 'with space' });

    expect(updated).toBe('# backend\nVITE_APP_BACKEND_URL=http://old\n\nVITE_PORT=4000\nVITE_NEW="with space"\n');
    expect(readDotenv(updated)).toEqual({
      VITE_APP_BACKEND_URL: 'http://old',
      VITE_PORT: '4000',
      VITE_NEW: 'with space',
    });
  });
});
