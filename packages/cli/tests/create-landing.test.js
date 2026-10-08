import fs from 'node:fs';

import { makeTempDir, runCli } from './helpers.js';

const CREATE = [
  'create',
  'landing',
  '--name',
  'Acme',
  '--description',
  'The operations center for your business.',
  '--description-es',
  'El centro de operaciones de tu negocio.',
  '--no-install',
  '--json',
];

describe('create landing', () => {
  it('plans the site, writes it, and answers with what to run next', async () => {
    const cwd = makeTempDir();
    const planned = await runCli([...CREATE, '--dry-run', '--cwd', cwd]);
    const created = await runCli([...CREATE, '--cwd', cwd]);

    expect(planned.code).toBe(0);
    expect(planned.json().plan.create.map((entry) => entry.path)).toContain('acme/src/views/home/HomePage.astro');
    expect(fs.existsSync(`${cwd}/acme`)).toBe(true);
    expect(created.json()).toMatchObject({ ok: true, project: { kind: 'landing', url: 'https://acme.com' } });
    expect(created.json().next).toEqual(['cd acme', 'npm install', 'npm run dev', 'npm run verify']);
  }, 30000);

  it('adds a page and a section, checks the result and describes it', async () => {
    const cwd = makeTempDir();
    await runCli([...CREATE, '--cwd', cwd]);
    const project = `${cwd}/acme`;
    const page = await runCli([
      'add',
      'page',
      '--path',
      '/pricing',
      '--title-en',
      'Pricing',
      '--title-es',
      'Precios',
      '--nav',
      'header',
      '--yes',
      '--json',
      '--cwd',
      project,
    ]);
    const section = await runCli([
      'add',
      'section',
      '--page',
      'pricing',
      '--kind',
      'faq',
      '--items-en',
      'Is there a free plan?|Yes, for small teams.',
      '--items-es',
      '¿Hay un plan gratis?|Sí, para equipos pequeños.',
      '--yes',
      '--json',
      '--cwd',
      project,
    ]);
    const check = await runCli(['check', '--json', '--cwd', project]);
    const described = await runCli(['describe', '--project', '--json', '--cwd', project]);

    expect(page.json().ok).toBe(true);
    expect(section.json().ok).toBe(true);
    expect(check.json().ok).toBe(true);
    expect(described.json().data.pages).toEqual(
      expect.arrayContaining([{ path: '/pricing', view: 'pricing', sections: ['hero', 'faq', 'page-cta'] }]),
    );
    expect(described.json().data.generators.map((generator) => generator.id)).toEqual([
      'page',
      'section',
      'blog-post',
      'copy',
    ]);
  }, 30000);
});
