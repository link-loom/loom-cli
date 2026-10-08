import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { makeTempDir, runCli } from './helpers.js';

const createProject = async () => {
  const cwd = makeTempDir();
  await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
  return `${cwd}/acme-workspace`;
};

const LOOSE_TEXT = 'export default function Hello() {\n  return <p>Hello there</p>;\n}\n';

describe('check', () => {
  it('passes on a project just created', async () => {
    const outcome = await runCli(['check', '--json', '--cwd', await createProject()]);

    expect(outcome.code).toBe(0);
    expect(outcome.json().data).toMatchObject({ ok: true, errors: 0 });
  }, 30000);

  it('fails with exit code 4 and every failing rule, with the file', async () => {
    const project = await createProject();
    fs.mkdirSync(`${project}/src/components/shared/hello`, { recursive: true });
    fs.writeFileSync(`${project}/src/components/shared/hello/Hello.component.jsx`, LOOSE_TEXT);
    const outcome = await runCli(['check', '--json', '--cwd', project]);
    const [error] = outcome.json().errors;

    expect(outcome.code).toBe(4);
    expect(error.code).toBe('E_CHECK_FAILED');
    expect(error.checks.map((check) => check.id)).toEqual(['copy', 'tests']);
    expect(error.checks[0].problems[0]).toMatchObject({
      file: 'src/components/shared/hello/Hello.component.jsx',
      line: 2,
    });
  }, 30000);

  it('runs only the rules asked for', async () => {
    const project = await createProject();
    fs.mkdirSync(`${project}/src/components/shared/hello`, { recursive: true });
    fs.writeFileSync(`${project}/src/components/shared/hello/Hello.component.jsx`, LOOSE_TEXT);
    const outcome = await runCli(['check', '--rules', 'structure,i18n-parity', '--json', '--cwd', project]);

    expect(outcome.code).toBe(0);
    expect(outcome.json().data.checks.map((check) => check.id)).toEqual(['structure', 'i18n-parity']);
  }, 30000);

  it('looks only at what git sees as changed with --changed', async () => {
    const project = await createProject();
    const outside = await runCli(['check', '--changed', '--json', '--cwd', project]);
    execFileSync('git', ['init', '-q'], { cwd: project });
    execFileSync('git', ['add', '.'], { cwd: project });
    execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-qm', 'init'], {
      cwd: project,
    });
    const clean = await runCli(['check', '--changed', '--json', '--cwd', project]);

    expect(outside.code).toBe(2);
    expect(clean.code).toBe(0);
    expect(clean.json().data.checks.find((check) => check.id === 'copy').ok).toBe(true);
  }, 30000);
});

describe('describe --project', () => {
  it('answers what the project holds and what can be added to it', async () => {
    const outcome = await runCli(['describe', '--project', '--json', '--cwd', await createProject()]);
    const data = outcome.json().data;

    expect(outcome.code).toBe(0);
    expect(data).toMatchObject({
      type: 'webapp',
      slug: 'acme-workspace',
      collection: { name: '@link-loom/react-generators' },
    });
    expect(data.generators.map((generator) => generator.command)).toEqual(
      expect.arrayContaining(['add entity', 'add page', 'add nav-item', 'add copy', 'add feature']),
    );
    expect(data.generators.map((generator) => generator.id)).not.toContain('seo');
    expect(data.pages.length).toBeGreaterThan(10);
  }, 30000);

  it('needs a project', async () => {
    const outcome = await runCli(['describe', '--project', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(2);
  });
});
