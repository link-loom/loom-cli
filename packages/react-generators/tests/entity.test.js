import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, loadCollection, readGeneratorSchema, validateOptions } from '@link-loom/devkit';

import entityGenerator from '../src/generators/entity/index.js';
import { entityCopyEn, entityCopyEs } from '../src/generators/entity/copy.js';
import { parseCustomActions, parseFields } from '../src/generators/entity/fields.js';
import { entityNames, inlineOf, pluralOf } from '../src/generators/entity/naming.js';
import webappGenerator from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const collection = loadCollection(COLLECTION_DIR);
const webappSchema = readGeneratorSchema(collection.generators.webapp);
const entitySchema = readGeneratorSchema(collection.generators.entity);

const PRODUCT = {
  domain: 'inventory',
  entity: 'product',
  fields: ['name:text:required', 'sku:text:list', 'price:number', 'status:options=active|archived', 'notes:longtext'],
  singularEs: 'Producto',
  pluralEs: 'Productos',
  fieldLabelsEs: ['name=Nombre', 'sku=SKU', 'price=Precio', 'status=Estado', 'notes=Notas'],
  customActions: ['archive:call'],
  actionLabelsEs: ['archive=Archivar'],
  icon: 'inventory',
  quickAdd: true,
};

/** A freshly created webapp in a virtual tree, and a way to add an entity to it. */
const createApp = async (input = {}) => {
  const tree = new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-entity-')) });
  const outcome = await webappGenerator(tree, validateOptions(webappSchema, { name: 'Acme Workspace', ...input }));
  const directory = outcome.project.directory;
  const read = (file) => tree.read(`${directory}/${file}`, 'utf8');
  const add = (entity) =>
    entityGenerator(tree, validateOptions(entitySchema, entity), {
      project: JSON.parse(read('loom.json')),
      directory,
    });
  return { tree, directory, read, add };
};

describe('entity names', () => {
  it('derives every name a CRUD needs from the domain and the entity', () => {
    expect(entityNames({ domain: 'security', entity: 'api-key' })).toMatchObject({
      Prefix: 'SecurityApiKey',
      plural: 'api-keys',
      copyPath: 'security.apiKey',
      listPath: '/security/api-keys',
      serviceClass: 'SecurityApiKeyService',
      serviceFile: 'security-api-key.service',
      routesFile: 'security-api-key.routes',
    });
    expect([pluralOf('category'), pluralOf('box'), pluralOf('key')]).toEqual(['categories', 'boxes', 'keys']);
    expect([inlineOf('Product'), inlineOf('API key')]).toEqual(['product', 'API key']);
  });
});

describe('entity fields', () => {
  it('reads types, flags, labels and the default columns', () => {
    const fields = parseFields({
      specs: ['name:text:required', 'price:number', 'notes:longtext', 'key:secret', 'status:options=a|b'],
      labelsEs: { name: 'Nombre', 'status.a': 'Uno' },
    });

    expect(fields.map((field) => [field.name, field.type, field.inList, field.readonly])).toEqual([
      ['name', 'text', true, false],
      ['price', 'number', true, false],
      ['notes', 'longtext', false, false],
      ['key', 'secret', false, true],
      ['status', 'options', true, false],
    ]);
    expect(fields[0]).toMatchObject({ labelEn: 'Name', labelEs: 'Nombre', isTitle: true, required: true });
    expect(fields[4].optionLabels).toEqual({ en: { a: 'A', b: 'B' }, es: { a: 'Uno', b: 'B' } });
  });

  it('refuses specs it cannot honour', () => {
    const problem = (specs) => {
      try {
        parseFields({ specs });
      } catch (error) {
        return error.code;
      }
      return null;
    };

    expect(problem(['price:number'])).toBe('E_VALIDATION');
    expect(problem(['name:text', 'name:number'])).toBe('E_VALIDATION');
    expect(problem(['name:text', 'kind:color'])).toBe('E_VALIDATION');
    expect(problem(['name:text', 'kind:options'])).toBe('E_VALIDATION');
    expect(problem(['name:text', 'kind:text:hidden'])).toBe('E_VALIDATION');
  });

  it('gives every secret its copy action, beside the custom ones', () => {
    const fields = parseFields({ specs: ['name:text', 'api_key:secret'], labelsEs: { api_key: 'Clave' } });
    const actions = parseCustomActions({ specs: ['rotate:replace'], fields, labelsEn: { rotate: 'Rotate' } });

    expect(actions.map((action) => [action.id, action.kind, action.labelEn, action.labelEs])).toEqual([
      ['copy-api-key', 'copy', 'Copy api key', 'Copiar clave'],
      ['rotate', 'replace', 'Rotate', 'Rotate'],
    ]);
    expect(() => parseCustomActions({ specs: ['copy-x:copy:missing'], fields })).toThrow(
      expect.objectContaining({ code: 'E_VALIDATION' }),
    );
  });
});

describe('entity copy', () => {
  const fields = parseFields({ specs: ['name:text'] });
  const labels = (genderEs) => ({
    singularEn: 'API key',
    pluralEn: 'API keys',
    singularEs: 'Clave de API',
    pluralEs: 'Claves de API',
    genderEs,
  });

  it('agrees the Spanish with the gender of the noun', () => {
    const feminine = entityCopyEs({ labels: labels('f'), fields, actions: [] });
    const masculine = entityCopyEs({
      labels: {
        singularEn: 'Product',
        pluralEn: 'Products',
        singularEs: 'Producto',
        pluralEs: 'Productos',
        genderEs: 'm',
      },
      fields,
      actions: [],
    });

    expect(feminine).toMatchObject({
      new: 'Nueva clave de API',
      filteredEmptyTitle: 'Ninguna clave de API coincide con estos filtros',
      deleteConfirm: { title: '¿Eliminar esta clave de API?' },
    });
    expect(masculine).toMatchObject({ new: 'Nuevo producto', deleteConfirm: { title: '¿Eliminar este producto?' } });
  });

  it('names the destructive action as the entity calls it', () => {
    const catalogLabels = [{ id: 'delete', key: 'delete', labelEn: 'Revoke', labelEs: 'Revocar' }];

    expect(entityCopyEn({ labels: labels('f'), fields, actions: [], catalogLabels })).toMatchObject({
      new: 'New API key',
      deleteConfirm: { title: 'Revoke this API key?', action: 'Revoke' },
      actions: { delete: 'Revoke' },
    });
    expect(entityCopyEs({ labels: labels('f'), fields, actions: [], catalogLabels }).deleteConfirm.title).toBe(
      '¿Revocar esta clave de API?',
    );
  });
});

describe('entity generator', () => {
  it('is how every app gets its API keys', async () => {
    const { read } = await createApp();
    const manifest = JSON.parse(read('loom.json'));

    expect(read('src/components/pages/security/api-key/list/SecurityApiKeyList.component.jsx')).toContain(
      'service.list({ organizationId, ...list.pagination })',
    );
    expect(read('src/services/security/api-key/security-api-key.service.js')).toContain(
      'const ENDPOINT = "/security/api-key";',
    );
    expect(read('src/components/pages/security/api-key/security-api-key.utils.js')).toContain(
      'const CREATE_DEFAULTS = Object.freeze({ project_id: "acme-workspace" });',
    );
    expect(read('src/routes/domains/security/security-api-key.routes.jsx')).toContain('path="security/api-keys/:id"');
    expect(read('src/components/layouts/sidebar/navigation.js')).not.toContain('security-api-keys');
    expect(read('src/components/layouts/navbar/omnisearch.registry.js')).not.toContain('SecurityApiKeyService');
    expect(manifest.entities).toEqual([
      expect.objectContaining({
        domain: 'security',
        entity: 'api-key',
        scope: 'organization',
        customActions: ['copy-key', 'rotate'],
      }),
    ]);
  });

  it('writes the CRUD and registers it in the sidebar, Omnisearch, the + menu, the icons and the copy', async () => {
    const { tree, directory, read, add } = await createApp();
    const outcome = await add(PRODUCT);
    const created = tree
      .plan()
      .create.map((entry) => entry.path.slice(directory.length + 1))
      .filter((file) => file.includes('inventory'));

    expect(created).toEqual(
      expect.arrayContaining([
        'src/routes/domains/inventory/inventory-product.routes.jsx',
        'src/pages/inventory/InventoryProductList.page.jsx',
        'src/pages/inventory/InventoryProductDetail.page.jsx',
        'src/services/inventory/product/inventory-product.service.js',
        'src/components/pages/inventory/product/list/InventoryProductList.component.jsx',
        'src/components/pages/inventory/product/list/InventoryProductList.sommatic.jsx',
        'src/components/pages/inventory/product/record/InventoryProductRecord.component.jsx',
        'src/components/pages/inventory/product/record/InventoryProductDetailsTab.component.jsx',
        'src/components/pages/inventory/product/record/InventoryProductDialog.component.jsx',
        'src/components/pages/inventory/product/record/InventoryProductDetail.component.jsx',
        'src/components/pages/inventory/product/quick-actions/InventoryProductQuickActions.component.jsx',
        'tests/inventory/product/inventory-product.flow.test.jsx',
        'tests/services/inventory/product/inventory-product.service.test.js',
      ]),
    );
    expect(read('src/components/layouts/sidebar/navigation.js')).toMatch(
      /id: "inventory-products".*\n\s+\{\n\s+id: "advanced"/,
    );
    expect(read('src/components/layouts/navbar/omnisearch.registry.js')).toContain(
      'import InventoryProductService from "@services/inventory/product/inventory-product.service";',
    );
    expect(read('src/components/layouts/navbar/quick-add.registry.js')).toContain('to: "/inventory/products?new=1"');
    expect(read('src/constants/iconLibrary.js')).toMatch(/Inventory2Outlined,[\s\S]*inventory: Inventory2Outlined,/);
    expect(read('src/i18n/es.js')).toContain('new: "Nuevo producto",');
    expect(read('src/services/inventory/product/inventory-product.service.js')).toContain('async archive(id)');
    expect(outcome.warnings).toEqual([]);
  });

  it('tells Omnisearch which field titles an item when it is not its name', async () => {
    const { read, add } = await createApp();
    await add({ domain: 'inventory', entity: 'warehouse', fields: ['display_name:text:required'], omnisearch: true });

    expect(read('src/components/layouts/navbar/omnisearch.registry.js')).toContain(
      'itemLabel: (item) => item.display_name,',
    );
  });

  it('leaves no template syntax behind, nor files for pieces the entity does not need', async () => {
    const { tree, directory, add } = await createApp();
    await add({ domain: 'crm', entity: 'contact', fields: ['name:text'], actions: ['quickview'] });
    const files = tree
      .plan()
      .create.filter((entry) => entry.path.includes('/crm/') || entry.path.includes('/contact/'));

    expect(files.filter((entry) => tree.read(entry.path, 'utf8').includes('<%'))).toEqual([]);
    expect(files.map((entry) => entry.path.slice(directory.length + 1))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/QuickActions|DetailsTab/)]),
    );
  });

  it('warns when the Spanish labels are missing', async () => {
    const { add } = await createApp();
    const outcome = await add({ domain: 'crm', entity: 'contact', fields: ['name:text', 'phone:text'] });

    expect(outcome.warnings[0]).toMatch(
      /^Spanish copy fell back to English for: singularEs\/pluralEs, fieldLabelsEs name/,
    );
  });

  it('refuses an entity that is already there', async () => {
    const { add } = await createApp();

    await expect(add({ domain: 'security', entity: 'api-key' })).rejects.toMatchObject({ code: 'E_TARGET_EXISTS' });
  });

  it('runs only inside a webapp', async () => {
    const tree = new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-entity-')) });

    await expect(
      entityGenerator(tree, validateOptions(entitySchema, PRODUCT), { project: { type: 'landing' } }),
    ).rejects.toMatchObject({ code: 'E_USAGE' });
  });
});
