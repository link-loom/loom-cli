import fs from 'node:fs';

import { compareVersions } from '../src/commands/update.js';
import { makeTempDir, runCli, steps } from './helpers.js';

/** A project created a while ago: older SDK ranges, a lock that pins them and an older collection version. */
const createOldProject = async () => {
  const cwd = makeTempDir();
  await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
  const root = `${cwd}/acme-workspace`;
  const packageJson = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8'));
  packageJson.dependencies['@link-loom/react-sdk'] = '^1.1.70';
  packageJson.dependencies['@link-loom/cloud-sdk'] = '^1.1.0';
  fs.writeFileSync(`${root}/package.json`, JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(
    `${root}/package-lock.json`,
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'acme-workspace' },
        'node_modules/@link-loom/react-sdk': { version: '1.1.70' },
        'node_modules/@link-loom/cloud-sdk': { version: '1.1.0' },
        'node_modules/@link-loom/cloud-sdk/node_modules/@link-loom/react-sdk': { version: '1.1.69' },
        'node_modules/react': { version: '19.2.0' },
      },
    }),
  );
  const manifest = JSON.parse(fs.readFileSync(`${root}/loom.json`, 'utf8'));
  fs.writeFileSync(
    `${root}/loom.json`,
    JSON.stringify({ ...manifest, collection: { ...manifest.collection, version: '2.9.0' } }),
  );
  return root;
};

describe('update', () => {
  it('orders the versions a collection uses', () => {
    expect(compareVersions('3.0.0', '3.0.0-alpha.2')).toBeGreaterThan(0);
    expect(compareVersions('3.0.0-alpha.10', '3.0.0-alpha.2')).toBeGreaterThan(0);
    expect(compareVersions('2.9.0', '3.0.0-alpha.0')).toBeLessThan(0);
    expect(compareVersions('^1.1.79', '1.1.79')).toBe(0);
  });

  it('reports what would change with --check', async () => {
    const outcome = await runCli(['update', '--check', '--json', '--cwd', await createOldProject()]);
    const data = outcome.json().data;

    expect(data.collection.from).toBe('2.9.0');
    expect(data.packages).toEqual(
      expect.arrayContaining([
        { name: '@link-loom/react-sdk', from: '^1.1.70', to: expect.stringMatching(/^\^1\.1\.\d+$/) },
        { name: '@link-loom/cloud-sdk', from: '^1.1.0', to: expect.any(String) },
      ]),
    );
  }, 30000);

  it('sets the ranges, drops the stale lock entries and records the collection, after --yes', async () => {
    const root = await createOldProject();
    const refused = await runCli(['update', '--json', '--cwd', root]);
    const applied = await runCli(['update', '--yes', '--no-install', '--json', '--cwd', root]);
    const lock = JSON.parse(fs.readFileSync(`${root}/package-lock.json`, 'utf8'));

    expect(refused.code).toBe(3);
    expect(applied.code).toBe(0);
    expect(JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8')).dependencies['@link-loom/react-sdk']).not.toBe(
      '^1.1.70',
    );
    expect(Object.keys(lock.packages)).toEqual(['', 'node_modules/react']);
    expect(JSON.parse(fs.readFileSync(`${root}/loom.json`, 'utf8')).collection.version).not.toBe('2.9.0');
    expect(applied.json().next).toEqual(['npm install', 'npx link-loom check', 'npm run build']);
    expect(refused.stderr).toBe('');
    expect(steps(applied.stderr)).toEqual(['write', 'done']);
  }, 30000);

  it('has nothing to do on a project just created', async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    const outcome = await runCli(['update', '--json', '--cwd', `${cwd}/acme-workspace`]);

    expect(outcome.code).toBe(0);
    expect(outcome.json().warnings).toEqual(['Already up to date']);
    expect(outcome.stderr).toBe('');
  }, 30000);
});
