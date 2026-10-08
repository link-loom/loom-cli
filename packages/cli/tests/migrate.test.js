import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTempDir, runCli, steps } from './helpers.js';

const LEGACY = fileURLToPath(new URL('../../migrate/tests/fixtures/legacy-app', import.meta.url));

describe('migrate', () => {
  it('writes the decisions draft, then builds the project from the finished decisions', async () => {
    const cwd = makeTempDir();
    const analyzed = await runCli(['migrate', 'analyze', LEGACY, '--json', '--cwd', cwd]);
    const decisionsFile = path.join(cwd, 'migration.decisions.json');

    expect(analyzed.code).toBe(0);
    expect(analyzed.json().data.inventory.routes).toHaveLength(1);
    expect(analyzed.json().next[1]).toContain('migrate apply --decisions migration.decisions.json');

    const decisions = JSON.parse(fs.readFileSync(decisionsFile, 'utf8'));
    decisions.texts = decisions.texts.map((text) => ({ ...text, es: `${text.en} (es)` }));
    decisions.navigation = decisions.navigation.map((row) => ({ ...row, labelEs: 'Ítems' }));
    fs.writeFileSync(decisionsFile, JSON.stringify(decisions));
    const applied = await runCli([
      'migrate',
      'apply',
      '--decisions',
      'migration.decisions.json',
      '--out',
      'acme-admin',
      '--no-install',
      '--json',
      '--cwd',
      cwd,
    ]);

    expect(applied.code).toBe(0);
    expect(applied.json().data.report).toBe('MIGRATION.md');
    expect(steps(applied.stderr)).toEqual(['write', 'done']);
    expect(fs.existsSync(path.join(cwd, 'acme-admin/src/pages/item/ItemInventoryItems.page.jsx'))).toBe(true);
    expect(applied.json().next).toContain('npx link-loom migrate finish');
    expect(JSON.parse(fs.readFileSync(path.join(cwd, 'acme-admin/loom.json'), 'utf8')).migration.carried).toContain(
      'src/pages/item/ItemInventoryItems.page.jsx',
    );

    const finished = await runCli(['migrate', 'finish', 'acme-admin', '--json', '--cwd', cwd]);
    expect(finished.code).toBe(3);
    expect(finished.json().errors[0].message).toContain('run npm install first');
  }, 30000);

  it('documents the decisions and plans a dry run without writing', async () => {
    const cwd = makeTempDir();
    const schema = await runCli(['schema', 'migration', '--json', '--cwd', cwd]);
    expect(schema.code).toBe(0);
    expect(Object.keys(schema.json().data.properties)).toEqual(
      expect.arrayContaining(['project', 'files', 'entities', 'navigation', 'texts', 'links']),
    );

    const help = await runCli(['migrate', 'apply', '--help', '--cwd', cwd]);
    expect(help.stdout).toContain('npx link-loom schema migration');

    await runCli(['migrate', 'analyze', LEGACY, '--json', '--cwd', cwd]);
    const planned = await runCli([
      'migrate',
      'apply',
      '--decisions',
      'migration.decisions.json',
      '--out',
      'acme-admin',
      '--dry-run',
      '--json',
      '--cwd',
      cwd,
    ]);
    expect(planned.code).toBe(0);
    expect(planned.json().dryRun).toBe(true);
    expect(planned.json().plan.create.length).toBeGreaterThan(50);
    expect(fs.existsSync(path.join(cwd, 'acme-admin'))).toBe(false);
  }, 30000);

  it('finishes only a project built by migrate apply', async () => {
    const outcome = await runCli(['migrate', 'finish', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(2);
  });

  it('asks for what apply needs', async () => {
    const outcome = await runCli(['migrate', 'apply', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].missing).toEqual(['decisions', 'out']);
  });
});
