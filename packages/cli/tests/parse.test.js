import { parseArgv, splitFlags } from '../src/cli/parse.js';
import { MODES, resolveMode } from '../src/cli/mode.js';

describe('parseArgv', () => {
  it('reads positionals, values, inline values and negations', () => {
    expect(parseArgv(['create', 'service', '--name', 'demo', '--shape=microservice', '--no-install'])).toEqual({
      positionals: ['create', 'service'],
      flags: { name: 'demo', shape: 'microservice', install: false },
    });
  });

  it('never lets a known boolean swallow the next token', () => {
    expect(parseArgv(['--json', 'describe'])).toEqual({ positionals: ['describe'], flags: { json: true } });
  });

  it('turns kebab-case flags into camelCase and reads short flags', () => {
    expect(parseArgv(['--dry-run', '--brand-primary', '#3c4876', '-i'])).toEqual({
      positionals: [],
      flags: { dryRun: true, brandPrimary: '#3c4876', interactive: true },
    });
  });

  it('keeps every word of a list written with spaces, once the command is named', () => {
    expect(
      parseArgv(['add', 'entity', '--actions', 'quickview', 'copy-link', '--field-labels-en', 'name=Name', '--yes']),
    ).toEqual({
      positionals: ['add', 'entity'],
      flags: { actions: ['quickview', 'copy-link'], fieldLabelsEn: 'name=Name', yes: true },
    });
    expect(parseArgv(['--input', 'in.json', 'create', 'webapp'])).toEqual({
      positionals: ['create', 'webapp'],
      flags: { input: 'in.json' },
    });
  });

  it('separates the CLI flags from the generator input', () => {
    expect(splitFlags({ json: true, cwd: '/tmp', template: './t', name: 'demo', shape: 'monolith' })).toEqual({
      global: { json: true, cwd: '/tmp', template: './t' },
      input: { name: 'demo', shape: 'monolith' },
    });
  });
});

describe('resolveMode', () => {
  const tty = { isTTY: true };
  const pipe = { isTTY: false };

  it('is human in an interactive terminal', () => {
    expect(resolveMode({ env: {}, stdin: tty, stdout: tty })).toBe(MODES.human);
  });

  it('is agent with --json, in CI, with LINK_LOOM_MODE=agent or without a TTY', () => {
    expect(resolveMode({ global: { json: true }, env: {}, stdin: tty, stdout: tty })).toBe(MODES.agent);
    expect(resolveMode({ env: { CI: 'true' }, stdin: tty, stdout: tty })).toBe(MODES.agent);
    expect(resolveMode({ env: { LINK_LOOM_MODE: 'agent' }, stdin: tty, stdout: tty })).toBe(MODES.agent);
    expect(resolveMode({ env: {}, stdin: pipe, stdout: tty })).toBe(MODES.agent);
  });
});
