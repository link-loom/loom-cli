import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, loadCollection, readGeneratorSchema, validateOptions } from '@link-loom/devkit';

import entityGenerator from '../src/generators/entity/index.js';
import webappGenerator from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const GOLDEN_DIR = fileURLToPath(new URL('./golden/entity/', import.meta.url));
const collection = loadCollection(COLLECTION_DIR);

// `LOOM_UPDATE_GOLDEN=1 npm test` rewrites the golden files after a deliberate change to the templates.
const UPDATE = process.env.LOOM_UPDATE_GOLDEN === '1';

const PRODUCT = {
  domain: 'inventory',
  entity: 'product',
  fields: ['name:text:required', 'sku:text:list', 'price:number', 'status:options=active|archived', 'notes:longtext'],
  singularEs: 'Producto',
  pluralEs: 'Productos',
  fieldLabelsEs: ['name=Nombre', 'sku=SKU', 'price=Precio', 'status=Estado', 'notes=Notas'],
};

const CASES = Object.freeze({
  standard: { ...PRODUCT, list: 'standard', customActions: ['archive:call'], actionLabelsEs: ['archive=Archivar'] },
  compact: { ...PRODUCT, list: 'compact', actions: ['quickview', 'delete'] },
  cards: { ...PRODUCT, list: 'cards', actions: ['open-page', 'copy-link'], rowClick: 'page' },
  organization: { ...PRODUCT, scope: 'organization', createDefaults: ['project_id={slug}'], section: 'advanced' },
});

const GOLDEN_FILES = Object.freeze([
  'src/components/pages/inventory/product/list/InventoryProductList.component.jsx',
  'src/components/pages/inventory/product/record/InventoryProductRecord.component.jsx',
  'src/components/pages/inventory/product/inventory-product.utils.js',
  'src/services/inventory/product/inventory-product.service.js',
]);

const generate = async (input) => {
  const tree = new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-golden-')) });
  const webappSchema = readGeneratorSchema(collection.generators.webapp);
  const { project } = await webappGenerator(tree, validateOptions(webappSchema, { name: 'Acme Workspace' }));
  const read = (file) => tree.read(`${project.directory}/${file}`, 'utf8');
  await entityGenerator(tree, validateOptions(readGeneratorSchema(collection.generators.entity), input), {
    project: JSON.parse(read('loom.json')),
    directory: project.directory,
  });
  return read;
};

describe.each(Object.entries(CASES))('entity golden files: %s', (name, input) => {
  it('matches the reviewed output', async () => {
    const read = await generate(input);
    for (const file of GOLDEN_FILES) {
      const golden = path.join(GOLDEN_DIR, name, `${path.basename(file)}.golden`);
      if (UPDATE) {
        fs.mkdirSync(path.dirname(golden), { recursive: true });
        fs.writeFileSync(golden, read(file));
        continue;
      }

      expect({ file, content: read(file) }).toEqual({ file, content: fs.readFileSync(golden, 'utf8') });
    }
  });
});
