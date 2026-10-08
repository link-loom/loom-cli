import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCheckProject, runChecks } from '@link-loom/devkit';
import { RULES } from '@link-loom/react-generators/src/check/index.js';

import { analyzeRepo } from '../src/analyze.js';
import { applyMigration } from '../src/apply.js';

const LEGACY = fileURLToPath(new URL('./fixtures/legacy-app', import.meta.url));

/** The draft finished the way a person would: Spanish for every text and the sidebar row. */
const finished = () => {
  const { decisions } = analyzeRepo(LEGACY);
  return {
    ...decisions,
    project: { ...decisions.project, name: 'Acme Admin', descriptionEs: 'La consola de administración de Acme.' },
    texts: decisions.texts.map((text) => ({
      ...text,
      es: { 'Every item': 'Todos los ítems', 'Item photo': 'Foto del ítem', ready: 'lista', Items: 'Ítems' }[text.text],
    })),
    navigation: decisions.navigation.map((row) => ({ ...row, labelEs: 'Ítems', sectionEs: 'Gestión' })),
  };
};

describe('migrate analyze', () => {
  it('reads the routes, the files in use, the texts, the sidebar and the brand', () => {
    const { inventory, decisions } = analyzeRepo(LEGACY);
    const byFile = Object.fromEntries(decisions.files.map((decision) => [decision.file, decision]));

    expect(inventory.routes).toEqual([
      {
        path: '/admin/item',
        component: 'InventoryItems',
        file: 'src/pages/inventory/InventoryItems.jsx',
        layout: 'LayoutAdmin',
      },
    ]);
    expect(byFile['src/pages/inventory/InventoryItems.jsx']).toMatchObject({
      action: 'move',
      kind: 'page',
      domain: 'item',
      name: 'InventoryItems',
    });
    expect(byFile['src/components/layouts/sidebar/SidebarAdmin.jsx']).toMatchObject({ action: 'discard' });
    expect(byFile['src/hooks/useUnused.hook.js']).toMatchObject({ action: 'discard', reason: 'nothing imports it' });
    expect(byFile['src/services/base/api.service.js']).toMatchObject({ kind: 'service', base: true });
    expect(decisions.navigation).toEqual([
      {
        id: 'items',
        to: '/admin/item',
        labelEn: 'Items',
        labelEs: '',
        icon: 'category',
        sectionEn: 'Management',
        sectionEs: '',
      },
    ]);
    expect(decisions.texts.map((text) => text.text)).toEqual(['Every item', 'Item photo', 'ready', 'Items']);
    expect(decisions.project).toMatchObject({ variant: 'admin', primaryColor: '#563e2e', stoneos: false });
    expect(decisions.assets).toEqual([{ path: '/assets/images/item.svg', keep: true }]);
  });
});

describe('migrate apply', () => {
  it('builds the new project from the decisions and leaves the legacy one untouched', async () => {
    const before = fs.readFileSync(path.join(LEGACY, 'src/components/pages/item/ItemSummary.jsx'), 'utf8');
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loom-migrate-')), 'acme-admin');
    const outcome = await applyMigration({ decisions: finished(), outDir: out });
    const read = (file) => fs.readFileSync(path.join(out, file), 'utf8');

    const page = read('src/pages/item/ItemInventoryItems.page.jsx');
    expect(page).toContain('usePageMeta({ title: copy.item.inventoryItems.items });');
    expect(page).not.toContain('useEffect');
    expect(page).toContain('const isAdmin = true;');
    expect(page).not.toContain('useOutletContext');
    expect(page).toContain('import ItemSummary from "@components/pages/item/item-summary/ItemSummary.component";');

    const summary = read('src/components/pages/item/item-summary/ItemSummary.component.jsx');
    expect(summary).toContain('<h2>{copy.item.itemSummary.everyItem}</h2>');
    expect(summary).toContain('borderColor: LEGACY_COLORS.hex838790');
    expect(summary).toContain('import InventoryItemService from "@services/inventory/item/inventory-item.service";');
    expect(read('src/i18n/es.js')).toContain('everyItem: "Todos los ítems",');
    expect(read('src/constants/theme.js')).toContain("brandBeige: '#fef2e6'");
    expect(read('src/routes/domains/item/item-inventory-items.routes.jsx')).toContain(
      '<Route path="item" element={<ItemInventoryItemsPage />} />',
    );
    expect(read('src/components/layouts/sidebar/navigation.js')).toContain(
      '{ id: "items", kind: "link", labelKey: "nav.items", icon: "category", to: "/item", sectionKey: "nav.sections.items" }',
    );
    expect(read('src/i18n/es.js')).toContain('items: "Gestión",');
    expect(fs.existsSync(path.join(out, 'public/assets/images/item.svg'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'tests/components/pages/item/item-summary/ItemSummary.test.jsx'))).toBe(true);
    expect(read('MIGRATION.md')).toContain('LEGACY_COLORS');
    expect(fs.readFileSync(path.join(LEGACY, 'src/components/pages/item/ItemSummary.jsx'), 'utf8')).toBe(before);

    const manifest = JSON.parse(read('loom.json'));
    const report = runChecks({ rules: RULES, project: createCheckProject({ root: out, manifest }) });
    expect(report.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(outcome.pending).toEqual(expect.arrayContaining([expect.stringContaining('LEGACY_COLORS')]));
  }, 30000);
});

describe('migrate apply, before building', () => {
  it('answers the plan of a dry run and writes nothing', async () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loom-migrate-')), 'acme-admin');
    const outcome = await applyMigration({ decisions: finished(), outDir: out, dryRun: true });

    expect(outcome.plan.create.map((entry) => entry.path)).toContain('src/pages/item/ItemInventoryItems.page.jsx');
    expect(fs.existsSync(out)).toBe(false);
  }, 30000);

  it('refuses two texts that share a key with different words', async () => {
    const decisions = finished();
    decisions.texts = decisions.texts.map((text) => ({ ...text, key: 'item.same' }));

    await expect(
      applyMigration({ decisions, outDir: path.join(os.tmpdir(), 'never-written'), dryRun: true }),
    ).rejects.toMatchObject({ code: 'E_VALIDATION' });
  });

  it('refuses carried code that uses a name whose file is discarded', async () => {
    const decisions = finished();
    decisions.files = decisions.files.map((decision) =>
      decision.file.includes('inventory-item') || decision.file.includes('InventoryItem.service')
        ? { file: decision.file, action: 'discard' }
        : decision,
    );

    await expect(
      applyMigration({ decisions, outDir: path.join(os.tmpdir(), 'never-written'), dryRun: true }),
    ).rejects.toMatchObject({
      code: 'E_VALIDATION',
      details: {
        problems: [expect.objectContaining({ message: expect.stringContaining('uses InventoryItemService') })],
      },
    });
  });

  it('lists the texts of the decisions that match no text of the code', async () => {
    const decisions = finished();
    decisions.texts.push({ ...decisions.texts[0], start: 1, text: 'Invented', key: 'item.invented', en: 'x', es: 'y' });
    const outcome = await applyMigration({
      decisions,
      outDir: path.join(os.tmpdir(), 'never-written-2'),
      dryRun: true,
    });

    expect(outcome.pending).toEqual(expect.arrayContaining([expect.stringContaining('no text at offset 1')]));
  }, 30000);
});
