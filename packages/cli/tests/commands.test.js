import fs from 'node:fs';
import path from 'node:path';

import { CLI_VERSION } from '../src/version.js';
import { SERVICE_TEMPLATE, makeTempDir, runCli, steps } from './helpers.js';

const createService = (cwd, extra = []) =>
  runCli([
    'create',
    'service',
    '--name',
    'demo',
    '--template',
    SERVICE_TEMPLATE,
    '--cwd',
    cwd,
    '--no-install',
    ...extra,
  ]);

describe('global flags', () => {
  it('prints the version', async () => {
    const outcome = await runCli(['--version']);

    expect(outcome.code).toBe(0);
    expect(outcome.stdout.trim()).toBe(CLI_VERSION);
  });

  it('prints the help', async () => {
    const outcome = await runCli(['--help']);

    expect(outcome.code).toBe(0);
    expect(outcome.stdout).toContain('link-loom create <type>');
  });

  it('answers with the machine contract when an agent runs it without a command', async () => {
    const outcome = await runCli(['--json']);

    expect(outcome.code).toBe(0);
    expect(outcome.json().data.cli.version).toBe(CLI_VERSION);
  });
});

describe('describe', () => {
  it('lists every project type with its command and status', async () => {
    const { data } = (await runCli(['describe', '--json'])).json();

    expect(data.projectTypes.map((type) => [type.id, type.command, type.status])).toEqual([
      ['landing', 'create landing', 'available'],
      ['webapp-client', 'create webapp', 'available'],
      ['webapp-admin', 'create webapp', 'available'],
      ['service-monolith', 'create service', 'available'],
      ['service-microservice', 'create service', 'available'],
      ['stoneos-app', null, 'planned'],
    ]);
  });

  it('publishes the exit codes and the code of every error', async () => {
    const { data } = (await runCli(['describe', '--json'])).json();

    expect(data.exitCodes).toEqual({ ok: 0, failure: 1, usage: 2, precondition: 3, qualityGate: 4, interrupted: 130 });
    expect(data.errorCodes).toMatchObject({ E_VALIDATION: 2, E_TARGET_EXISTS: 3, E_NOT_AVAILABLE: 3, E_FETCH: 1 });
  });

  it('publishes how long runs report their progress, for agents and over MCP', async () => {
    const { data } = (await runCli(['describe', '--json'])).json();

    expect(data.progress.commands).toEqual({
      create: ['render', 'write', 'install'],
      update: ['write', 'install', 'verify'],
      'migrate apply': ['write', 'install', 'finish'],
    });
    expect(data.progress.last).toEqual({ step: 'done', progress: 100, message: 'Done' });
    expect(data.progress.mcp).toContain('notifications/progress');
    expect(data.progress.nonBlocking).toContain('--no-install');
  });

  it('renders a readable table without --json', async () => {
    const outcome = await runCli(['describe']);

    expect(outcome.stdout).toContain('Backend monolith');
    expect(outcome.stdout).toContain('(planned)');
  });
});

describe('schema', () => {
  it('returns the JSON Schema of an available generator', async () => {
    const outcome = await runCli(['schema', 'service', '--json']);

    expect(outcome.code).toBe(0);
    expect(outcome.json().data.required).toEqual(['name']);
  });

  it('answers with E_NOT_AVAILABLE for a planned generator', async () => {
    const outcome = await runCli(['schema', 'seo', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(3);
    expect(outcome.json().errors[0].code).toBe('E_NOT_AVAILABLE');
  });
});

describe('create service', () => {
  it('returns the plan on a dry run and writes nothing', async () => {
    const cwd = makeTempDir();
    const outcome = await createService(cwd, ['--dry-run', '--json']);
    const result = outcome.json();

    expect(outcome.code).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      command: 'create service',
      dryRun: true,
      input: { name: 'demo', shape: 'monolith', ref: 'master' },
    });
    expect(result.plan.create).toHaveLength(4);
    expect(fs.existsSync(path.join(cwd, 'demo'))).toBe(false);
    expect(outcome.stderr).toBe('');
  });

  it('writes the project and tells what comes next', async () => {
    const cwd = makeTempDir();
    const outcome = await createService(cwd, ['--json']);
    const result = outcome.json();

    expect(outcome.code).toBe(0);
    expect(result.next).toEqual(['cd demo', 'npm install', 'cp config/template.json config/default.json', 'npm start']);
    expect(fs.readFileSync(path.join(cwd, 'demo/config/template.json'), 'utf8')).toContain('"name": "demo"');
  });

  it('exits with 2 and lists the missing input', async () => {
    const outcome = await runCli(['create', 'service', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0]).toMatchObject({ code: 'E_VALIDATION', missing: ['name'] });
  });

  it('exits with 2 for a value outside the schema', async () => {
    const outcome = await createService(makeTempDir(), ['--shape', 'tiny', '--json']);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].problems).toEqual([
      { field: 'shape', message: 'must be equal to one of the allowed values' },
    ]);
  });

  it('exits with 3 when the target folder exists', async () => {
    const cwd = makeTempDir();
    fs.mkdirSync(path.join(cwd, 'demo'));
    const outcome = await createService(cwd, ['--json']);

    expect(outcome.code).toBe(3);
    expect(outcome.json().errors[0].code).toBe('E_TARGET_EXISTS');
  });

  it('reads the input from a JSON file and lets flags override it', async () => {
    const cwd = makeTempDir();
    fs.writeFileSync(path.join(cwd, 'input.json'), JSON.stringify({ name: 'from-file', shape: 'microservice' }));
    const outcome = await runCli([
      'create',
      'service',
      '--input',
      'input.json',
      '--shape',
      'monolith',
      '--template',
      SERVICE_TEMPLATE,
      '--cwd',
      cwd,
      '--dry-run',
      '--json',
    ]);

    expect(outcome.json().input).toMatchObject({ name: 'from-file', shape: 'monolith' });
  });

  it('keeps the v2 form working with a deprecation warning', async () => {
    const cwd = makeTempDir();
    const outcome = await runCli([
      'create',
      '--name',
      'demo',
      '--template',
      SERVICE_TEMPLATE,
      '--cwd',
      cwd,
      '--no-install',
      '--json',
    ]);

    expect(outcome.code).toBe(0);
    expect(outcome.json().warnings[0]).toContain('deprecated');
  });

  it('prints a readable summary without --json', async () => {
    const outcome = await createService(makeTempDir());

    expect(outcome.stdout).toContain('+ 4 create');
    expect(outcome.stderr).toContain('% Writing the files');
    expect(outcome.stderr).toContain('› 100% Done');
  });
});

describe('create errors', () => {
  it('exits with 2 when no project type is given', async () => {
    const outcome = await runCli(['create', '--json']);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0]).toMatchObject({ code: 'E_USAGE', allowed: ['landing', 'webapp', 'service'] });
  });

  it('exits with 2 for an unknown command', async () => {
    const outcome = await runCli(['frobnicate', '--json']);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].code).toBe('E_UNKNOWN_COMMAND');
  });

  it('reports its progress on stderr as one JSON event per line with --json, and keeps one document on stdout', async () => {
    const outcome = await runCli([
      'create',
      'service',
      '--name',
      'demo',
      '--template',
      SERVICE_TEMPLATE,
      '--no-install',
      '--json',
      '--cwd',
      makeTempDir(),
    ]);
    const events = outcome.stderr
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(outcome.json().ok).toBe(true);
    expect(steps(outcome.stderr)).toEqual(['render', 'write', 'done']);
    expect(events.every((event) => event.event === 'progress' && event.total === 100)).toBe(true);
    expect(events.at(-1).progress).toBe(100);
  });
});
