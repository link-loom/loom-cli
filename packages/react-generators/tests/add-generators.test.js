import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VirtualTree, importGenerator, loadCollection, readGeneratorSchema, validateOptions } from '@link-loom/devkit';

import webappGenerator from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const collection = loadCollection(COLLECTION_DIR);

/** A webapp in a virtual tree, and `add(generator, input)` to run a generator of the collection on it. */
const createApp = async (input = {}) => {
  const tree = new VirtualTree({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'loom-add-')) });
  const webapp = collection.generators.webapp;
  const outcome = await webappGenerator(
    tree,
    validateOptions(readGeneratorSchema(webapp), { name: 'Acme Workspace', ...input }),
  );
  const { directory } = outcome.project;
  const read = (file) => tree.read(`${directory}/${file}`, 'utf8');
  const add = async (id, options) => {
    const generator = collection.generators[id];
    const generate = await importGenerator(generator);
    return generate(tree, validateOptions(readGeneratorSchema(generator), options), {
      project: JSON.parse(read('loom.json')),
      directory,
    });
  };
  const created = () => tree.plan().create.map((entry) => entry.path.slice(directory.length + 1));
  return { read, add, created };
};

describe('add page', () => {
  it('writes the page, its component, route, copy, test and companion, and its sidebar row', async () => {
    const app = await createApp();
    const outcome = await app.add('page', {
      domain: 'reports',
      name: 'stock-summary',
      titleEn: 'Stock summary',
      titleEs: 'Resumen de inventario',
      navigation: true,
      icon: 'chart',
    });

    expect(app.created()).toEqual(
      expect.arrayContaining([
        'src/pages/reports/ReportsStockSummary.page.jsx',
        'src/components/pages/reports/stock-summary/ReportsStockSummary.component.jsx',
        'src/components/pages/reports/stock-summary/ReportsStockSummary.sommatic.jsx',
        'src/routes/domains/reports/reports-stock-summary.routes.jsx',
        'tests/components/pages/reports/stock-summary/ReportsStockSummary.test.jsx',
      ]),
    );
    expect(app.read('src/routes/domains/reports/reports-stock-summary.routes.jsx')).toContain(
      'path="reports/stock-summary"',
    );
    expect(app.read('src/i18n/es.js')).toContain('title: "Resumen de inventario",');
    expect(app.read('src/components/layouts/sidebar/navigation.js')).toContain(
      'labelKey: "reports.stockSummary.title"',
    );
    expect(app.read('src/constants/iconLibrary.js')).toContain('chart: BarChartOutlined,');
    expect(outcome.project.page.path).toBe('/client/reports/stock-summary');
    expect(outcome.warnings).toEqual([]);
  });

  it('sits under Advanced settings without a sidebar row, and refuses a page that exists', async () => {
    const app = await createApp({ commandCenter: false });
    await app.add('page', {
      domain: 'management',
      name: 'audit-log',
      titleEn: 'Audit log',
      section: 'advanced',
      navigation: true,
    });

    expect(app.read('src/pages/management/ManagementAuditLog.page.jsx')).toContain('copy.management.title');
    expect(app.read('src/components/layouts/sidebar/navigation.js')).not.toContain('audit-log');
    expect(app.created().some((file) => file.endsWith('.sommatic.jsx') && file.includes('audit-log'))).toBe(false);
    await expect(app.add('page', { domain: 'management', name: 'audit-log', titleEn: 'Again' })).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
    });
  });
});

describe('add component, service and hook', () => {
  it('writes each with its test where the conventions put it', async () => {
    const app = await createApp();
    await app.add('component', { name: 'StockGauge', domain: 'reports' });
    await app.add('component', { name: 'SectionTitle' });
    await app.add('service', { domain: 'reports', entity: 'snapshot', calls: ['refresh'] });
    await app.add('hook', { name: 'useStockFilters' });

    expect(app.created()).toEqual(
      expect.arrayContaining([
        'src/components/pages/reports/stock-gauge/StockGauge.component.jsx',
        'tests/components/pages/reports/stock-gauge/StockGauge.test.jsx',
        'src/components/shared/section-title/SectionTitle.component.jsx',
        'src/services/reports/snapshot/reports-snapshot.service.js',
        'tests/services/reports/snapshot/reports-snapshot.service.test.js',
        'src/hooks/useStockFilters.hook.js',
        'tests/hooks/useStockFilters.test.js',
      ]),
    );
    expect(app.read('src/services/reports/snapshot/reports-snapshot.service.js')).toContain('async refresh(id)');
  });
});

describe('add nav-item, settings-section, platform-section and copy', () => {
  it('registers each entry with its copy', async () => {
    const app = await createApp();
    await app.add('nav-item', {
      id: 'help-desk',
      labelEn: 'Help desk',
      labelEs: 'Mesa de ayuda',
      to: '/help-center',
      icon: 'mail',
    });
    await app.add('settings-section', {
      id: 'audit-log',
      titleEn: 'Audit log',
      descriptionEn: 'Who changed what, and when.',
      to: '/management/audit-log',
      color: 'purple',
    });
    const platform = await app.add('platform-section', {
      platform: 'veripass',
      id: 'users',
      titleEn: 'Users',
      titleEs: 'Usuarios',
      descriptionEn: 'The people of your organization.',
      descriptionEs: 'Las personas de tu organización.',
      to: '/identity/users',
      icon: 'people',
    });
    await app.add('copy', { key: 'reports.lowStock', en: 'Low stock', es: 'Inventario bajo' });

    expect(app.read('src/components/layouts/sidebar/navigation.js')).toContain('labelKey: "nav.helpDesk"');
    expect(app.read('src/components/pages/management/home/management.sections.js')).toContain(
      'titleKey: "management.titles.auditLog"',
    );
    expect(app.read('src/components/pages/platforms/hub/platform.sections.js')).toContain(
      'veripass: [\n    { id: "users", to: "/identity/users", titleKey: "platforms.sections.veripass.users.title"',
    );
    expect(app.read('src/i18n/es.js')).toContain('lowStock: "Inventario bajo",');
    expect(platform.warnings).toEqual([]);
    await expect(app.add('copy', { key: 'reports.lowStock', en: 'x', es: 'y' })).rejects.toMatchObject({
      code: 'E_TARGET_EXISTS',
    });
    await app.add('copy', {
      key: 'auth.signin.heroTitle',
      en: 'Identity you trust.',
      es: 'Identidad confiable.',
      replace: true,
    });
    expect(app.read('src/i18n/es.js')).toContain('heroTitle: "Identidad confiable.",');
  });

  it('places a row before another, under a section title, or inside a group', async () => {
    const app = await createApp();
    await app.add('nav-item', { id: 'dashboard', labelEn: 'Dashboard', to: '/dashboard', icon: 'dashboard' });
    await app.add('nav-item', {
      id: 'items',
      labelEn: 'Items',
      labelEs: 'Artículos',
      to: '/item/management',
      icon: 'category',
      group: 'inventory',
      groupEn: 'Inventory',
      groupEs: 'Inventario',
      groupIcon: 'inventory',
      sectionEn: 'Management',
      sectionEs: 'Gestión',
    });
    await app.add('nav-item', {
      id: 'items-daily',
      labelEn: 'Items daily',
      to: '/item/daily',
      icon: 'today',
      group: 'inventory',
    });
    await app.add('nav-item', { id: 'welcome', labelEn: 'Welcome', to: '/welcome', icon: 'home', before: 'dashboard' });
    await app.add('nav-item', {
      id: 'preferences',
      labelEn: 'Preferences',
      to: '/preferences',
      icon: 'settings',
      last: true,
    });

    const navigation = app.read('src/components/layouts/sidebar/navigation.js');
    expect(navigation.indexOf('id: "welcome"')).toBeLessThan(navigation.indexOf('id: "dashboard"'));
    expect(navigation).toContain(
      '{ id: "inventory", kind: "group", labelKey: "nav.inventory", icon: "inventory", sectionKey: "nav.sections.inventory", items: [',
    );
    expect(navigation).toContain('{ id: "items-daily", labelKey: "nav.itemsDaily", icon: "today", to: "/item/daily" }');
    expect(navigation.indexOf('id: "inventory"')).toBeLessThan(navigation.indexOf('id: "advanced"'));
    expect(navigation.indexOf('id: "preferences"')).toBeGreaterThan(navigation.indexOf('id: "advanced"'));
    expect(app.read('src/i18n/es.js')).toContain('inventory: "Inventario",');
    expect(app.read('src/constants/iconLibrary.js')).toContain('today: TodayOutlined');
  });

  it('needs the stoneos layer for platform sections', async () => {
    const app = await createApp({ stoneos: false });

    await expect(
      app.add('platform-section', {
        platform: 'veripass',
        id: 'users',
        titleEn: 'Users',
        descriptionEn: 'People.',
        to: '/x',
      }),
    ).rejects.toMatchObject({ code: 'E_NOT_AVAILABLE' });
  });
});

describe('add feature', () => {
  it('adds the images manifest, the masters folder, the scripts and sharp, once', async () => {
    const app = await createApp();
    const outcome = await app.add('feature', { name: 'images' });
    const packageJson = JSON.parse(app.read('package.json'));

    expect(app.created()).toEqual(expect.arrayContaining(['images.manifest.json', 'assets/img-source/.gitkeep']));
    expect(packageJson.scripts).toMatchObject({
      'gen:images': 'link-loom images generate',
      'og:compose': 'link-loom images og',
    });
    expect(packageJson.devDependencies.sharp).toMatch(/^\^0\.34/);
    expect(JSON.parse(app.read('loom.json')).features).toEqual(['images']);
    expect(outcome.next[0]).toContain('services add image-generation');
    await expect(app.add('feature', { name: 'images' })).rejects.toMatchObject({ code: 'E_TARGET_EXISTS' });
  });
});
