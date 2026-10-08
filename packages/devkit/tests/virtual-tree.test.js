import fs from 'node:fs';

import { VirtualTree } from '../src/index.js';
import { makeTempDir, writeFile } from './helpers.js';

describe('VirtualTree', () => {
  it('records creations in memory without touching the disk', () => {
    const root = makeTempDir();
    const tree = new VirtualTree({ root });

    tree.create('app/index.js', 'export {};\n');

    expect(tree.exists('app/index.js')).toBe(true);
    expect(tree.read('app/index.js')).toBe('export {};\n');
    expect(fs.existsSync(`${root}/app/index.js`)).toBe(false);
    expect(tree.plan()).toEqual({ create: [{ path: 'app/index.js', bytes: 11 }], modify: [], delete: [] });
  });

  it('refuses to create a file that already exists on disk', () => {
    const root = makeTempDir();
    writeFile(root, 'package.json', '{}');
    const tree = new VirtualTree({ root });

    expect(() => tree.create('package.json', '{}')).toThrow(
      expect.objectContaining({ code: 'E_TARGET_EXISTS', exitCode: 3 }),
    );
  });

  it('reports an overwrite of a file on disk as a modification and a removal as a deletion', () => {
    const root = makeTempDir();
    writeFile(root, 'a.txt', 'old');
    writeFile(root, 'b.txt', 'gone');
    const tree = new VirtualTree({ root });

    tree.overwrite('a.txt', 'new');
    tree.delete('b.txt');

    expect(tree.read('a.txt')).toBe('new');
    expect(tree.exists('b.txt')).toBe(false);
    expect(tree.plan()).toEqual({ create: [], modify: [{ path: 'a.txt', bytes: 3 }], delete: [{ path: 'b.txt' }] });
  });

  it('rejects paths that escape the root', () => {
    const tree = new VirtualTree({ root: makeTempDir() });

    expect(() => tree.create('../outside.txt', 'x')).toThrow('Invalid tree path');
  });
});
