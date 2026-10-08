import fs from 'node:fs';
import path from 'node:path';

import { VirtualTree, applyTree } from '../src/index.js';
import { makeTempDir, readFile, writeFile } from './helpers.js';

describe('applyTree', () => {
  it('writes nothing on a dry run', () => {
    const root = path.join(makeTempDir(), 'project');
    const tree = new VirtualTree({ root });
    tree.create('index.js', 'x');

    const outcome = applyTree(tree, { dryRun: true });

    expect(outcome.applied).toBe(false);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('creates, modifies and deletes files and leaves no staging folder behind', () => {
    const root = makeTempDir();
    writeFile(root, 'keep.txt', 'old');
    writeFile(root, 'remove.txt', 'bye');
    const tree = new VirtualTree({ root });
    tree.create('src/new.js', 'new');
    tree.overwrite('keep.txt', 'updated');
    tree.delete('remove.txt');

    const outcome = applyTree(tree);

    expect(outcome.applied).toBe(true);
    expect(readFile(root, 'src/new.js')).toBe('new');
    expect(readFile(root, 'keep.txt')).toBe('updated');
    expect(fs.existsSync(path.join(root, 'remove.txt'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.loom-tmp'))).toBe(false);
  });

  it('rolls everything back when a write fails, including a root it created', () => {
    const base = makeTempDir();
    const root = path.join(base, 'project');
    const tree = new VirtualTree({ root });
    tree.create('a.txt', 'a');
    tree.create('a.txt/child.txt', 'cannot live under a file');

    expect(() => applyTree(tree)).toThrow(expect.objectContaining({ code: 'E_IO', exitCode: 1 }));
    expect(fs.existsSync(root)).toBe(false);
  });

  it('restores the original content of modified files after a failure', () => {
    const root = makeTempDir();
    writeFile(root, 'a.txt', 'original');
    const tree = new VirtualTree({ root });
    tree.overwrite('a.txt', 'changed');
    tree.create('a.txt/child.txt', 'cannot live under a file');

    expect(() => applyTree(tree)).toThrow(expect.objectContaining({ code: 'E_IO' }));
    expect(readFile(root, 'a.txt')).toBe('original');
  });
});
