import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree } from '@link-loom/devkit';

import serviceGenerator from '../src/generators/service/index.js';

const TEMPLATE = fileURLToPath(new URL('./fixtures/loom-svc-js-mini', import.meta.url));
const NOTIFICATION = 'src/services/notification/notification-management/notification-management.service.js';

const makeTree = () => new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-svc-')) });

const run = (options, templateDir = TEMPLATE) =>
  serviceGenerator(makeTree(), { shape: 'monolith', ref: 'master', ...options }, { templateDir });

describe('service generator', () => {
  it('copies the template into a folder named after the project', async () => {
    const tree = makeTree();
    await serviceGenerator(tree, { name: 'billing', shape: 'monolith', ref: 'master' }, { templateDir: TEMPLATE });

    expect(tree.plan().create.map((entry) => entry.path)).toEqual([
      'billing/.env.sample',
      'billing/config/template.json',
      'billing/package.json',
      `billing/${NOTIFICATION}`,
    ]);
  });

  it('replaces the %LOOM% placeholder in the three known places', async () => {
    const tree = makeTree();
    await serviceGenerator(tree, { name: 'billing', shape: 'monolith', ref: 'master' }, { templateDir: TEMPLATE });

    expect(tree.read('billing/package.json')).toContain('"billing"');
    expect(tree.read('billing/config/template.json')).toContain('"name": "billing"');
    expect(tree.read(`billing/${NOTIFICATION}`)).toContain('Welcome to billing');
    expect(tree.plan().create.some((entry) => tree.read(entry.path).includes('%LOOM%'))).toBe(false);
  });

  it('uses `directory` as the target folder when given', async () => {
    const tree = makeTree();
    const outcome = await serviceGenerator(
      tree,
      { name: 'billing', directory: 'svc/billing', shape: 'monolith', ref: 'master' },
      { templateDir: TEMPLATE },
    );

    expect(outcome.project.directory).toBe('svc/billing');
    expect(tree.exists('svc/billing/package.json')).toBe(true);
  });

  it('warns that both shapes share the template for now', async () => {
    const outcome = await run({ name: 'billing', shape: 'microservice' });

    expect(outcome.warnings).toContain(
      'monolith and microservice share the loom-svc-js template until node-generators ships its own layers',
    );
  });

  it('reports a template whose placeholders moved instead of guessing', async () => {
    const drifted = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-drift-'));
    fs.cpSync(TEMPLATE, drifted, { recursive: true });
    fs.writeFileSync(path.join(drifted, 'README.md'), '# %LOOM%\n');

    const outcome = await run({ name: 'billing' }, drifted);

    expect(outcome.warnings).toEqual(['loom-svc-js placeholders moved; review: README.md']);
  });

  it('refuses an existing target folder', async () => {
    const tree = makeTree();
    fs.mkdirSync(path.join(tree.root, 'billing'));

    await expect(
      serviceGenerator(tree, { name: 'billing', shape: 'monolith', ref: 'master' }, { templateDir: TEMPLATE }),
    ).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
      exitCode: 3,
    });
  });
});
