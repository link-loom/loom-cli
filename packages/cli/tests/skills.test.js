import fs from 'node:fs';

import { makeTempDir, runCli } from './helpers.js';

const createProject = async () => {
  const cwd = makeTempDir();
  await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
  return `${cwd}/acme-workspace`;
};

const SKILL = '.claude/skills/loom-react/SKILL.md';

describe('skills', () => {
  it('lists the skills of the collection and the version installed', async () => {
    const outcome = await runCli(['skills', 'list', '--json', '--cwd', await createProject()]);

    expect(outcome.json().data.skills).toEqual([
      expect.objectContaining({ name: 'loom-react', installed: expect.any(String), available: expect.any(String) }),
    ]);
  }, 30000);

  it('restores a skill file that went missing, and leaves one edited by hand unless forced', async () => {
    const project = await createProject();
    fs.rmSync(`${project}/.agent/skills/loom-react/SKILL.md`);
    fs.appendFileSync(`${project}/${SKILL}`, '\nOur own rule.\n');

    const synced = await runCli(['skills', 'sync', '--json', '--cwd', project]);
    expect(synced.code).toBe(0);
    expect(synced.json().data.conflicts).toEqual([SKILL]);
    expect(fs.existsSync(`${project}/.agent/skills/loom-react/SKILL.md`)).toBe(true);
    expect(fs.readFileSync(`${project}/${SKILL}`, 'utf8')).toContain('Our own rule.');

    const forced = await runCli(['skills', 'sync', '--force', '--yes', '--json', '--cwd', project]);
    expect(forced.code).toBe(0);
    expect(fs.readFileSync(`${project}/${SKILL}`, 'utf8')).not.toContain('Our own rule.');
  }, 30000);

  it('rejects an unknown action or skill', async () => {
    const project = await createProject();
    const action = await runCli(['skills', 'remove', '--json', '--cwd', project]);
    const skill = await runCli(['skills', 'install', 'loom-vue', '--json', '--cwd', project]);

    expect(action.json().errors[0]).toMatchObject({ code: 'E_USAGE', allowed: ['list', 'install', 'sync'] });
    expect(skill.json().errors[0]).toMatchObject({ code: 'E_USAGE', allowed: ['loom-react'] });
  }, 30000);
});
