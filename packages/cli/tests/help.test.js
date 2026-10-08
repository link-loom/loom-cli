import { makeTempDir, runCli } from './helpers.js';

describe('help of one generator', () => {
  it('prints the flags of create webapp and add entity, anywhere', async () => {
    const created = await runCli(['create', 'webapp', '--help']);
    const added = await runCli(['add', 'entity', '--help', '--cwd', makeTempDir()]);
    const general = await runCli(['--help']);

    expect(created.code).toBe(0);
    expect(created.stdout).toContain('Usage\n  link-loom create webapp [flags]');
    expect(created.stdout).toContain('--description-es <string>');
    expect(created.stdout).toMatch(/--variant client\|admin\n {6}client: .*\(default "client"\)/);
    expect(added.stdout).toContain('--domain <string>');
    expect(general.stdout).toContain('link-loom create <type> [flags]');
  });
});

describe('schema outside a project', () => {
  it('finds an add generator by name, and asks for --type when two project types have it', async () => {
    const cwd = makeTempDir();
    const entity = await runCli(['schema', 'entity', '--json', '--cwd', cwd]);
    const missing = await runCli(['schema', 'nothing-like-this', '--json', '--cwd', cwd]);

    expect(entity.code).toBe(0);
    expect(entity.json().data.$id).toBe('link-loom/react-generators/entity');
    expect(missing.json().errors[0].code).toBe('E_NOT_AVAILABLE');
  });
});
