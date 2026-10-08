import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VirtualTree,
  applyTree,
  createCheckProject,
  loadCollection,
  readGeneratorSchema,
  runChecks,
  validateOptions,
} from '@link-loom/devkit';

import { RULES } from '../src/check/index.js';
import { inventoryOf } from '../src/inventory.js';
import landingGenerator from '../src/generators/landing/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const schema = readGeneratorSchema(loadCollection(COLLECTION_DIR).generators.landing);

let template;

/** A fresh copy of a generated landing on disk, and a way to check it. */
const freshSite = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-landing-check-'));
  fs.cpSync(template, root, { recursive: true });
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const project = () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'loom.json'), 'utf8'));
    return createCheckProject({ root, manifest });
  };
  const check = (only = []) => runChecks({ rules: RULES, project: project(), only });
  return { root, write, check, project };
};

const problemsOf = (report, id) => report.checks.find((entry) => entry.id === id).problems;

beforeAll(async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-landing-template-'));
  const tree = new VirtualTree({ root: cwd });
  await landingGenerator(
    tree,
    validateOptions(schema, {
      name: 'Acme',
      description: 'The operations center for your business.',
      descriptionEs: 'El centro de operaciones de tu negocio.',
    }),
  );
  applyTree(tree);
  template = path.join(cwd, 'acme');
});

describe('landing check rules', () => {
  it('pass on a landing just created', () => {
    const report = freshSite().check();

    expect(report.checks.filter((entry) => !entry.ok)).toEqual([]);
    expect(report.checks.map((entry) => entry.id)).toEqual(RULES.map((rule) => rule.id));
  });

  it('structure, mirrored-pages and links: a stray file, a page without its twin, a link without a page', () => {
    const site = freshSite();
    site.write('src/components/Card.astro', '<div />\n');
    site.write('src/pages/en/pricing.astro', '---\n---\n<div />\n');
    const nav = path.join(site.root, 'src/data/nav.ts');
    fs.writeFileSync(nav, fs.readFileSync(nav, 'utf8').replace("path: '/contact' }", "path: '/missing' }"));
    const report = site.check(['structure', 'mirrored-pages', 'links']);

    expect(problemsOf(report, 'structure').map((problem) => problem.file)).toEqual(['src/components/Card.astro']);
    expect(problemsOf(report, 'mirrored-pages').map((problem) => problem.file)).toEqual(['src/pages/en/pricing.astro']);
    expect(problemsOf(report, 'links')[0].message).toBe('No page serves /missing');
  });

  it('sections: a section the page does not list', () => {
    const site = freshSite();
    site.write('src/views/home/sections/Orphan.astro', '<section />\n');

    expect(problemsOf(site.check(['sections']), 'sections')).toEqual([
      expect.objectContaining({ file: 'src/views/home/sections/Orphan.astro' }),
    ]);
  });

  it('copy, copy-parity, color-tokens and images: what a component must not carry', () => {
    const site = freshSite();
    site.write(
      'src/components/ui/Banner.astro',
      '---\nconst t = { title: "x" };\n---\n<section class="b"><h2>Welcome back</h2><p>{t.title}</p><img src="/x.png" /></section>\n<style>\n  .b { color: #ff0000; background: var(--site-white); }\n</style>\n',
    );
    const es = path.join(site.root, 'src/data/copy/es.ts');
    fs.writeFileSync(
      es,
      fs.readFileSync(es, 'utf8').replace('export const COPY = {', "export const COPY = {\n  soloEnEspanol: 'Hola',"),
    );
    const report = site.check(['copy', 'copy-parity', 'color-tokens', 'images']);

    expect(problemsOf(report, 'copy').map((problem) => problem.message)).toEqual([
      expect.stringContaining('Welcome back'),
    ]);
    expect(problemsOf(report, 'copy-parity')).toEqual([
      { file: 'src/data/copy/en.ts', message: 'Missing "soloEnEspanol", which es.ts has' },
    ]);
    expect(problemsOf(report, 'color-tokens')).toEqual([
      expect.objectContaining({ message: expect.stringContaining('#ff0000') }),
    ]);
    expect(problemsOf(report, 'images')).toHaveLength(1);
    expect(report.ok).toBe(false);
  });
});

describe('landing inventory', () => {
  it('lists the pages with their sections, the navigation and the posts', () => {
    const inventory = inventoryOf(freshSite().project());

    expect(inventory).toMatchObject({ type: 'landing', name: 'Acme', layers: ['base', 'blog', 'search', 'editor'] });
    expect(inventory.pages).toEqual(
      expect.arrayContaining([
        { path: '/', view: 'home', sections: ['hero', 'final-cta'] },
        { path: '/contact' },
        { path: '/legal/privacy' },
      ]),
    );
    expect(inventory.headerNav).toEqual([
      { id: 'blog', path: '/blog' },
      { id: 'contact', path: '/contact' },
    ]);
    expect(inventory.footerColumns).toEqual([
      { id: 'company', links: ['blog', 'contact'] },
      { id: 'legal', links: ['privacy', 'terms'] },
    ]);
    expect(inventory.posts).toEqual([]);
    expect(inventory.categories).toEqual(['product', 'guides', 'company']);
  });
});
