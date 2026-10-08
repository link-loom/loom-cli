import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, applyTree, loadCollection, readGeneratorSchema, validateOptions } from '@link-loom/devkit';

import webappGenerator from '../src/generators/webapp/index.js';
import brandGenerator from '../src/generators/brand/index.js';

const COLLECTION = loadCollection(fileURLToPath(new URL('..', import.meta.url)));
const schemaOf = (id) => readGeneratorSchema(COLLECTION.generators[id]);

/** A generated webapp on disk, the way `brand` finds it inside a project. */
const makeProject = async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-brand-'));
  const tree = new VirtualTree({ root });
  await webappGenerator(
    tree,
    validateOptions(schemaOf('webapp'), { name: 'Acme Workspace', description: 'Operations' }),
  );
  applyTree(tree);
  return path.join(root, 'acme-workspace');
};

const runBrand = async (projectRoot, input) => {
  const tree = new VirtualTree({ root: projectRoot });
  const outcome = await brandGenerator(tree, validateOptions(schemaOf('brand'), input));
  const plan = tree.plan();
  return { tree, plan, outcome, changed: [...plan.create, ...plan.modify].map((entry) => entry.path) };
};

describe('brand generator', () => {
  let projectRoot;

  beforeAll(async () => {
    projectRoot = await makeProject();
  });

  it('changes the palette with structural edits and rebuilds what depends on it', async () => {
    const { tree, changed } = await runBrand(projectRoot, { action: 'colors', primaryColor: '#1f4e79' });
    const theme = tree.read('src/constants/theme.js');

    expect(theme).toContain('brandPrimary: "#1f4e79"');
    expect(theme).toContain('header: "#1f4e79"');
    expect(theme).toContain('export const STATUS_BADGE_COLORS');
    expect(tree.read('src/constants/theme.js')).toContain('header: "#1f4e79"');
    expect(tree.read('src/styles/index.css')).not.toContain('--app-auth-to: #c3cfe2;');
    expect(JSON.parse(tree.read('loom.json')).brand.colors.header).toBe('#1f4e79');
    expect(changed).toEqual(
      expect.arrayContaining(['public/brand/favicon.ico', 'public/brand/og-default.jpg', 'public/site.webmanifest']),
    );
  });

  it('touches nothing when the brand does not change', async () => {
    const { changed } = await runBrand(projectRoot, { action: 'assets' });

    expect(changed).toEqual([]);
  });

  it('rebuilds only the share image for og', async () => {
    const { changed } = await runBrand(projectRoot, { action: 'og', tagline: 'Operations, in one place' });

    expect(changed).toEqual(['public/brand/og-default.jpg']);
  });

  it("uses the person's logo and keeps it when the assets are rebuilt later", async () => {
    const logo =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40"/></svg>';
    fs.writeFileSync(path.join(projectRoot, 'own-logo.svg'), logo);

    const first = await runBrand(projectRoot, { action: 'logo', logo: 'own-logo.svg' });
    applyTree(first.tree);
    const later = await runBrand(projectRoot, { action: 'assets' });

    expect(first.tree.read('public/brand/logo-light.svg')).toBe(logo);
    expect(JSON.parse(first.tree.read('loom.json')).brand.artwork).toBe('custom');
    expect(later.changed).toEqual([]);
  });

  it('starts over from a random palette, the same for the same seed', async () => {
    const first = await runBrand(projectRoot, { action: 'colors', brandMode: 'random', seed: 'acme' });
    const second = await runBrand(projectRoot, { action: 'colors', brandMode: 'random', seed: 'acme' });

    expect(first.outcome.project.brand.colors).toEqual(second.outcome.project.brand.colors);
    expect(first.outcome.warnings).toEqual([]);
  });
});
