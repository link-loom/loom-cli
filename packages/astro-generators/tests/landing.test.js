import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, importGenerator, loadCollection, readGeneratorSchema, validateOptions } from '@link-loom/devkit';

import landingGenerator from '../src/generators/landing/index.js';
import { splitAccent } from '../src/generators/section/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const collection = loadCollection(COLLECTION_DIR);
const SITE = {
  name: 'Acme',
  domain: 'acme.com',
  description: 'The operations center for your business.',
  descriptionEs: 'El centro de operaciones de tu negocio.',
};

/** A landing in a virtual tree, and `add(generator, input)` to run a generator of the collection on it. */
const createSite = async (input = {}) => {
  const tree = new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-landing-')) });
  const options = validateOptions(readGeneratorSchema(collection.generators.landing), { ...SITE, ...input });
  const outcome = await landingGenerator(tree, options);
  const { directory } = outcome.project;
  const read = (file) => tree.read(`${directory}/${file}`, 'utf8');
  const exists = (file) => tree.exists(`${directory}/${file}`);
  const add = async (id, generatorInput) => {
    const generator = collection.generators[id];
    const generate = await importGenerator(generator);
    return generate(tree, validateOptions(readGeneratorSchema(generator), generatorInput), {
      project: JSON.parse(read('loom.json')),
      directory,
    });
  };
  const created = () => tree.plan().create.map((entry) => entry.path.slice(directory.length + 1));
  return { outcome, read, exists, add, created };
};

describe('landing generator', () => {
  it('creates the frame, the home, contact and legal pages in both languages, and every layer by default', async () => {
    const site = await createSite();

    expect(site.outcome.project).toMatchObject({ directory: 'acme', kind: 'landing', url: 'https://acme.com' });
    expect(site.outcome.project.layers).toEqual(['base', 'blog', 'search', 'editor']);
    expect(site.created()).toEqual(
      expect.arrayContaining([
        'package.json',
        'loom.json',
        'AGENTS.md',
        'CLAUDE.md',
        '.mcp.json',
        'astro.config.mjs',
        'images.manifest.json',
        'public/_redirects',
        'public/brand/og-default-en.jpg',
        'public/brand/og-default-es.jpg',
        'public/brand/favicon.svg',
        'src/data/site.ts',
        'src/data/copy/en.ts',
        'src/data/copy/es.ts',
        'src/views/home/HomePage.astro',
        'src/views/home/sections/Hero.astro',
        'src/views/home/sections/FinalCta.astro',
        'src/pages/en/index.astro',
        'src/pages/es/legal/privacy.astro',
        'src/pages/es/blog/[slug].astro',
        'src/pages/en/search.astro',
        'src/content/blog/.gitkeep',
        '.claude/skills/loom-landing/SKILL.md',
      ]),
    );
    expect(site.created().some((file) => /\.ejs$/.test(file))).toBe(false);
    expect(site.read('src/data/site.ts')).toContain("url: 'https://acme.com',");
    expect(site.read('src/data/copy/es.ts')).toContain("deck: 'El centro de operaciones de tu negocio.',");
    expect(site.read('src/views/home/sections.ts')).toContain(
      "  { id: 'hero', component: Hero },\n  { id: 'final-cta', component: FinalCta },",
    );
    expect(site.outcome.warnings).toEqual([]);
  });

  it('leaves out what a layer brings when the layer is off', async () => {
    const site = await createSite({ blog: false, editor: false, search: false });
    const packageJson = JSON.parse(site.read('package.json'));

    expect(site.created().some((file) => file.includes('/blog') || file.includes('search'))).toBe(false);
    expect(site.read('src/components/layout/Header.astro')).not.toContain('import SearchTrigger');
    expect(site.read('src/data/nav.ts')).not.toContain("path: '/blog'");
    expect(site.read('astro.config.mjs')).not.toContain('pagefind');
    expect(packageJson.dependencies).not.toHaveProperty('react');
    expect(site.read('src/data/copy/en.ts')).not.toMatch(/^ {2}(blog|search): \{/m);
  });

  it('refuses the editor without the blog, and warns when the Spanish description is missing', async () => {
    await expect(createSite({ blog: false })).rejects.toMatchObject({ code: 'E_VALIDATION' });
    const englishOnly = await createSite({ descriptionEs: undefined });

    expect(englishOnly.outcome.warnings).toEqual([expect.stringContaining('--description-es')]);
  });
});

describe('add section', () => {
  it('writes the section, its copy in both languages, and lists it before the closing call to action', async () => {
    const site = await createSite();
    await site.add('section', {
      page: 'home',
      kind: 'cards',
      id: 'governance',
      tone: 'dark',
      titleEn: 'Attributable, reconstructible, auditable.',
      titleEs: 'Atribuible, reconstruible, auditable.',
      itemsEn: ['Who|Every action has an author.', 'Why|Every decision keeps its reason.'],
      itemsEs: ['Quién|Cada acción tiene autor.', 'Por qué|Cada decisión guarda su razón.'],
      icons: ['verified-user', 'visibility'],
    });

    expect(site.read('src/views/home/sections/Governance.astro')).toContain('getCopy(locale).home.governance');
    expect(site.read('src/views/home/sections/Governance.astro')).toContain("icon: 'ic:baseline-verified-user'");
    expect(site.read('src/data/copy/es.ts')).toContain("title: 'Quién',");
    expect(site.read('src/views/home/sections.ts')).toContain(
      "  { id: 'governance', component: Governance },\n  { id: 'final-cta', component: FinalCta },",
    );
    await expect(site.add('section', { page: 'home', kind: 'cards', id: 'governance' })).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
    });
  });

  it('refuses a page that does not exist and items that are not Title|Body', async () => {
    const site = await createSite();

    await expect(site.add('section', { page: 'pricing', kind: 'faq' })).rejects.toMatchObject({ code: 'E_EDIT_SHAPE' });
    await expect(
      site.add('section', { page: 'home', kind: 'split', id: 'story', itemsEn: ['No separator here'] }),
    ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  });

  it('splits a title on its *highlighted* words, or highlights the last word', () => {
    expect(splitAccent('The operations center your *whole business* runs on.')).toEqual({
      titleLead: 'The operations center your ',
      titleAccent: 'whole business',
      titleTail: ' runs on.',
    });
    expect(splitAccent('Start running today.')).toEqual({
      titleLead: 'Start running ',
      titleAccent: 'today',
      titleTail: '.',
    });
  });
});

describe('add page, blog-post and copy', () => {
  it('adds a page in both languages, its breadcrumb title and its footer link', async () => {
    const site = await createSite();
    const outcome = await site.add('page', {
      path: '/company',
      titleEn: 'Company',
      titleEs: 'Compañía',
      nav: 'footer:company',
    });

    expect(outcome.project.page.routes).toEqual(['src/pages/en/company.astro', 'src/pages/es/company.astro']);
    expect(site.read('src/pages/es/company.astro')).toContain('<CompanyPage locale="es" />');
    expect(site.read('src/views/company/sections.ts')).toContain(
      "{ id: 'hero', component: Hero },\n  { id: 'page-cta', component: PageCta },",
    );
    expect(site.read('src/data/pages.ts')).toContain(
      "{ id: 'company', path: '/company', title: { en: 'Company', es: 'Compañía' } }",
    );
    expect(site.read('src/data/nav.ts')).toMatch(
      /id: 'company',\n {4}title: [^\n]+\n {4}links: \[[\s\S]*\{ id: 'company', label: \{ en: 'Company', es: 'Compañía' \}, path: '\/company' \},/,
    );
    await expect(site.add('page', { path: '/company', titleEn: 'Again' })).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
    });
    await expect(site.add('page', { path: '/about', titleEn: 'About', nav: 'footer:missing' })).rejects.toMatchObject({
      code: 'E_EDIT_SHAPE',
    });
  });

  it('writes a post in English and Spanish, and rewrites copy only with --replace', async () => {
    const site = await createSite();
    await site.add('blog-post', {
      slug: 'why-one-board',
      titleEn: 'Why one board',
      titleEs: 'Por qué un tablero',
      category: 'guides',
      tags: ['ops'],
    });
    await site.add('copy', { key: 'home.hero.deck', en: 'New deck.', es: 'Nueva bajada.', replace: true });

    expect(site.read('src/content/blog/why-one-board.es.md')).toContain('title: "Por qué un tablero"\n');
    expect(site.read('src/content/blog/why-one-board.md')).toContain('base_slug: "why-one-board"');
    expect(site.read('src/data/copy/es.ts')).toContain("deck: 'Nueva bajada.',");
    await expect(site.add('blog-post', { slug: 'x', titleEn: 'X', category: 'nope' })).rejects.toMatchObject({
      code: 'E_VALIDATION',
    });
    await expect(site.add('copy', { key: 'home.hero.deck', en: 'a', es: 'b' })).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
    });
  });
});

describe('brand', () => {
  it('rewrites the brand and accent tokens, the theme colour and the files made from them', async () => {
    const site = await createSite();
    const outcome = await site.add('brand', { action: 'colors', primaryColor: '#1f4e79', accentColor: '#2fb673' });
    const tokens = site.read('src/styles/_tokens.scss');

    expect(tokens).toContain('  --site-brand: #1f4e79;');
    expect(tokens).toContain('  --site-accent: #2fb673;');
    expect(tokens).toContain('  --site-c-coral: #f0655c;');
    expect(site.read('src/data/site.ts')).toContain("themeColor: '#1f4e79',");
    expect(JSON.parse(site.read('loom.json')).brand.palette).toMatchObject({ brand: '#1f4e79', accent: '#2fb673' });
    expect(outcome.project.brand.artwork).toBe('generated');
  });

  it('asks for the logo file to change the logo', async () => {
    const site = await createSite();

    await expect(site.add('brand', { action: 'logo' })).rejects.toMatchObject({ code: 'E_VALIDATION' });
  });
});
