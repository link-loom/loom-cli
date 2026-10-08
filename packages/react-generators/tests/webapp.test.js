import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, readGeneratorSchema, validateOptions, loadCollection } from '@link-loom/devkit';

import webappGenerator, { slugify } from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const schema = readGeneratorSchema(loadCollection(COLLECTION_DIR).generators.webapp);

const makeTree = () => new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-webapp-')) });

/** Generates into a fresh virtual tree and returns `{ files: { path: text }, outcome }`, paths relative to the project. */
const generate = async (input) => {
  const options = validateOptions(schema, { name: 'Acme Workspace', ...input });
  const tree = makeTree();
  const outcome = await webappGenerator(tree, options);
  const prefix = `${outcome.project.directory}/`;
  const files = Object.fromEntries(
    tree.plan().create.map((entry) => [entry.path.slice(prefix.length), tree.read(entry.path, 'utf8')]),
  );
  return { files, outcome, tree };
};

const sourceFiles = (files) =>
  Object.entries(files).filter(([file]) => /^(src|tests|tools)\/.*\.(js|jsx|cjs)$/.test(file));

describe('webapp generator', () => {
  it('writes the description natively in each dictionary, and warns when the Spanish one is missing', async () => {
    const both = await generate({ description: 'Identity for everyone.', descriptionEs: 'Identidad para todos.' });
    const englishOnly = await generate({ description: 'Identity for everyone.' });

    expect(both.files['src/i18n/es.js']).toContain('heroSubtitle: "Identidad para todos.",');
    expect(both.files['src/i18n/en.js']).toContain('heroSubtitle: "Identity for everyone.",');
    expect(both.outcome.warnings).toEqual([]);
    expect(englishOnly.outcome.warnings).toEqual([expect.stringContaining('--description-es')]);
  });

  it('creates a client app with every layer by default', async () => {
    const { files, outcome } = await generate({});

    expect(outcome.project).toMatchObject({
      directory: 'acme-workspace',
      variant: 'client',
      basePath: '/client',
      layers: ['base', 'signup', 'stoneos', 'command-center'],
    });
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'package.json',
        'loom.json',
        'AGENTS.md',
        'CLAUDE.md',
        '.mcp.json',
        '.gitignore',
        '.env.sample',
        '.env.local',
        'index.html',
        'vite.config.js',
        'docker/Dockerfile',
        'docker/Dockerfile.runtime',
        'docker/nginx.conf',
        'src/main.jsx',
        'src/App.jsx',
        'src/app.config.js',
        'src/constants/theme.js',
        'src/i18n/en.js',
        'src/i18n/es.js',
        'src/components/layouts/extensions/command-center.extension.jsx',
        'src/components/layouts/extensions/stoneos.extension.jsx',
        'src/pages/auth/AuthSignup.page.jsx',
        'public/brand/logo-light.svg',
        'public/brand/og-default.jpg',
        'public/site.webmanifest',
        '.claude/skills/loom-react/SKILL.md',
        'tests/routes/routes.test.js',
      ]),
    );
  });

  it('leaves no template syntax behind', async () => {
    const { files } = await generate({});
    const textFiles = Object.entries(files).filter(([file]) => !/\.(png|jpg|ico)$/.test(file));

    expect(textFiles.filter(([file]) => file.endsWith('.ejs')).map(([file]) => file)).toEqual([]);
    expect(textFiles.filter(([, content]) => content.includes('<%')).map(([file]) => file)).toEqual([]);
  });

  it('starts at version 0.0.1 with version-patch and the verification scripts', async () => {
    const { files } = await generate({});
    const packageJson = JSON.parse(files['package.json']);

    expect(packageJson.version).toBe('0.0.1');
    expect(packageJson.scripts).toMatchObject({
      'version-patch': 'npm version patch && git push --tags',
      test: 'jest',
      verify: 'npm run lint && link-loom check && npm test && npm run build',
    });
    expect(Object.keys(packageJson.scripts).filter((script) => /test/.test(script))).toEqual(['test']);
  });

  it('without layers, never mentions StoneOS or Sommatic', async () => {
    const { files } = await generate({ stoneos: false, commandCenter: false, signup: false });
    const packageJson = JSON.parse(files['package.json']);
    const mentions = sourceFiles(files).filter(([, content]) =>
      /@link-loom\/cloud-sdk|@sommatic\/react-sdk/.test(content),
    );

    expect(mentions.map(([file]) => file)).toEqual([]);
    expect(packageJson.dependencies).not.toHaveProperty('@link-loom/cloud-sdk');
    expect(packageJson.dependencies).not.toHaveProperty('@sommatic/react-sdk');
    expect(files).not.toHaveProperty('src/pages/auth/AuthSignup.page.jsx');
    expect(files['src/routes/auth.routes.jsx']).not.toContain('AuthSignup');
    expect(files['src/components/layouts/sidebar/Sidebar.component.jsx']).toContain('AppSidebar');
  });

  it('writes a secret only to .env.local', async () => {
    const secret = 'vp_test_7f3a9c';
    const { files } = await generate({ veripassApiKey: secret });

    expect(files['.env.local']).toContain(`VITE_APP_VERIPASS_API_KEY=${secret}`);
    expect(
      Object.entries(files).filter(([file, content]) => file !== '.env.local' && content.includes(secret)),
    ).toEqual([]);
    expect(files['.gitignore']).toContain('.env.local');
  });

  it('gives both languages the same copy keys', async () => {
    const { files, tree, outcome } = await generate({});
    const load = async (locale) => {
      const file = path.join(tree.root, `${locale}.mjs`);
      fs.writeFileSync(file, files[`src/i18n/${locale}.js`]);
      return (await import(file)).default;
    };
    const keysOf = (node, prefix = '') =>
      Object.entries(node).flatMap(([key, value]) =>
        typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
      );

    const [en, es] = await Promise.all([load('en'), load('es')]);
    expect(keysOf(en)).toEqual(keysOf(es));
    expect(en.manageApp.title).toBe('Manage Acme Workspace');
    expect(es.manageApp.title).toBe('Gestionar Acme Workspace');
    expect(outcome.warnings).toEqual([]);
  });

  it('paints the palette the person chose and derives the logo area', async () => {
    const { files } = await generate({ headerColor: '#1f4e79' });

    expect(files['src/constants/theme.js']).toContain('header: "#1f4e79"');
    expect(files['src/constants/theme.js']).not.toContain('headerLogoArea: "#2f3a5f"');
  });

  it('warns when white text would not read on the header', async () => {
    const { outcome, files } = await generate({ headerColor: '#ffe08a', primaryColor: '#ffe08a' });

    expect(outcome.warnings.join(' ')).toMatch(/contrast/);
    expect(files['src/app.config.js']).toContain('wordmark-light.svg');
  });

  it('builds the admin variant under /admin', async () => {
    const { files } = await generate({ name: 'Acme Admin', variant: 'admin' });

    expect(files['src/app.config.js']).toContain('basePath: "/admin"');
  });

  it('refuses to overwrite an existing folder', async () => {
    const tree = makeTree();
    fs.mkdirSync(path.join(tree.root, 'acme-workspace'));
    const options = validateOptions(schema, { name: 'Acme Workspace' });

    await expect(webappGenerator(tree, options)).rejects.toMatchObject({ code: 'E_TARGET_EXISTS' });
  });

  it('derives the slug from the name', () => {
    expect(slugify('Êtrune ID Admin')).toBe('etrune-id-admin');
    expect(slugify('  Mi Retail — Workspace ')).toBe('mi-retail-workspace');
  });
});
