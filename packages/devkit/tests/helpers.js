import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const makeTempDir = (prefix = 'loom-devkit-') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export const writeFile = (root, relativePath, content) => {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
};

export const readFile = (root, relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
