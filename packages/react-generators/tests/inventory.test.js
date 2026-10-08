import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VirtualTree,
  applyTree,
  createCheckProject,
  loadCollection,
  readGeneratorSchema,
  validateOptions,
} from '@link-loom/devkit';

import { inventoryOf } from '../src/inventory.js';
import webappGenerator from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const schema = readGeneratorSchema(loadCollection(COLLECTION_DIR).generators.webapp);

describe('webapp inventory', () => {
  let inventory;

  beforeAll(async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-inventory-'));
    const tree = new VirtualTree({ root: cwd });
    await webappGenerator(tree, validateOptions(schema, { name: 'Acme Workspace' }));
    applyTree(tree);
    const root = path.join(cwd, 'acme-workspace');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'loom.json'), 'utf8'));
    inventory = inventoryOf(createCheckProject({ root, manifest }));
  });

  it('names the layers, domains and entities of the app', () => {
    expect(inventory).toMatchObject({
      type: 'webapp',
      variant: 'client',
      basePath: '/client',
      layers: ['base', 'signup', 'stoneos', 'command-center'],
      entities: [expect.objectContaining({ domain: 'security', entity: 'api-key' })],
    });
    expect(inventory.domains).toEqual(expect.arrayContaining(['management', 'overview', 'security']));
  });

  it('gives each page its full path, nested routes and the app slug included', () => {
    expect(inventory.pages).toEqual(
      expect.arrayContaining([
        { page: 'src/pages/auth/AuthSignin.page.jsx', path: '/auth/login' },
        { page: 'src/pages/overview/OverviewHome.page.jsx', path: '/client/overview' },
        { page: 'src/pages/management/ManageAppLocale.page.jsx', path: '/client/acme-workspace/locale' },
        { page: 'src/pages/security/SecurityApiKeyDetail.page.jsx', path: '/client/security/api-keys/:id' },
      ]),
    );
  });

  it('lists the entries of every registry', () => {
    expect(inventory.navigation.map((entry) => entry.id)).toEqual(['overview', 'advanced']);
    expect(inventory.quickAdd.map((entry) => entry.id)).toEqual(['api-key', 'app', 'support-case']);
    expect(inventory.settingsSections.map((entry) => entry.id)).toEqual(['manage-app', 'security', 'help-center']);
    expect(inventory.omnisearch).toEqual([]);
  });
});
