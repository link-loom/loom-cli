import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const GENERATOR_STATUS = Object.freeze({ available: 'available', planned: 'planned' });

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

/**
 * Reads a collection package: its `collection.json` declares each generator's factory, schema, summary and status.
 * Schemas and factories load lazily, so `describe` can list a collection without importing its code.
 */
export const loadCollection = (packageRoot) => {
  const manifest = readJson(path.join(packageRoot, 'collection.json'));
  const pkg = readJson(path.join(packageRoot, 'package.json'));

  const generators = Object.fromEntries(
    Object.entries(manifest.generators || {}).map(([id, entry]) => [
      id,
      {
        id,
        description: entry.description,
        status: entry.status || GENERATOR_STATUS.available,
        schemaPath: entry.schema ? path.join(packageRoot, entry.schema) : null,
        factoryPath: entry.factory ? path.join(packageRoot, entry.factory) : null,
      },
    ]),
  );

  return {
    name: pkg.name,
    version: pkg.version,
    root: packageRoot,
    generators,
    checkPath: manifest.check ? path.join(packageRoot, manifest.check) : null,
    inventoryPath: manifest.inventory ? path.join(packageRoot, manifest.inventory) : null,
    stackPath: manifest.stack ? path.join(packageRoot, manifest.stack) : null,
    migrations: Object.entries(manifest.migrations || {}).map(([version, file]) => ({
      version,
      path: path.join(packageRoot, file),
    })),
  };
};

export const readGeneratorSchema = (generator) => (generator.schemaPath ? readJson(generator.schemaPath) : null);

/** The quality rules a collection declares (`"check"` in collection.json), or none. */
export const importCheckRules = async (collection) => {
  if (!collection.checkPath) {
    return [];
  }

  const module = await import(pathToFileURL(collection.checkPath).href);
  return module.RULES;
};

/** How a collection reads a project's inventory (`"inventory"` in collection.json), or null. */
export const importInventory = async (collection) => {
  if (!collection.inventoryPath) {
    return null;
  }

  const module = await import(pathToFileURL(collection.inventoryPath).href);
  return module.inventoryOf;
};

export const importGenerator = async (generator) => {
  const module = await import(pathToFileURL(generator.factoryPath).href);
  return module.default;
};
