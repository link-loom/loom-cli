import path from 'node:path';
import { createRequire } from 'node:module';

import { loadCollection } from '@link-loom/devkit';

const require = createRequire(import.meta.url);

export const COLLECTION_PACKAGES = Object.freeze([
  '@link-loom/astro-generators',
  '@link-loom/react-generators',
  '@link-loom/node-generators',
]);

const loaded = new Map();

export const getCollection = (name) => {
  if (!loaded.has(name)) {
    loaded.set(name, loadCollection(path.dirname(require.resolve(`${name}/collection.json`))));
  }

  return loaded.get(name);
};

export const listCollections = () => COLLECTION_PACKAGES.map(getCollection);
