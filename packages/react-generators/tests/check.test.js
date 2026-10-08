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
import webappGenerator from '../src/generators/webapp/index.js';

const COLLECTION_DIR = fileURLToPath(new URL('..', import.meta.url));
const schema = readGeneratorSchema(loadCollection(COLLECTION_DIR).generators.webapp);

let template;

/** A fresh copy of a generated webapp on disk, and a way to check it. */
const freshApp = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-check-'));
  fs.cpSync(template, root, { recursive: true });
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const check = (only = []) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'loom.json'), 'utf8'));
    return runChecks({ rules: RULES, project: createCheckProject({ root, manifest }), only });
  };
  return { root, write, check };
};

const problemsOf = (report, id) => report.checks.find((entry) => entry.id === id).problems;

beforeAll(async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-check-template-'));
  const tree = new VirtualTree({ root: cwd });
  await webappGenerator(tree, validateOptions(schema, { name: 'Acme Workspace' }));
  applyTree(tree);
  template = path.join(cwd, 'acme-workspace');
});

describe('check rules', () => {
  it('pass on a webapp just created', () => {
    const report = freshApp().check();

    expect(report.checks.filter((entry) => !entry.ok)).toEqual([]);
    expect(report).toMatchObject({ ok: true, errors: 0, warnings: 0 });
    expect(report.checks.map((entry) => entry.id)).toEqual(RULES.map((rule) => rule.id));
  });

  it('structure: a file outside its folder or without its suffix', () => {
    const app = freshApp();
    app.write('src/components/shared/Card.jsx', 'export default function Card() { return null; }\n');
    app.write('src/helpers/format.js', 'export const format = (value) => value;\n');

    expect(problemsOf(app.check(['structure']), 'structure').map((problem) => problem.file)).toEqual([
      'src/components/shared/Card.jsx',
      'src/helpers/format.js',
    ]);
  });

  it('page-loaded and orphan-pages: a page without OnPageLoaded and without a route', () => {
    const app = freshApp();
    app.write(
      'src/pages/overview/OverviewStats.page.jsx',
      'export default function OverviewStatsPage() { return null; }\n',
    );
    const report = app.check(['page-loaded', 'orphan-pages']);

    expect(problemsOf(report, 'page-loaded')).toEqual([
      expect.objectContaining({ file: 'src/pages/overview/OverviewStats.page.jsx' }),
    ]);
    expect(problemsOf(report, 'orphan-pages')).toEqual([
      expect.objectContaining({ file: 'src/pages/overview/OverviewStats.page.jsx' }),
    ]);
  });

  it('record, no-select and bootstrap-grid: hand-made dialogs, selects and grids', () => {
    const app = freshApp();
    app.write(
      'src/components/pages/crm/contact/list/CrmContactList.component.jsx',
      [
        'import { Dialog, Grid, Select, TextField } from "@mui/material";',
        'import { DataGrid } from "@mui/x-data-grid";',
        'export default function CrmContactList({ copy }) {',
        '  return <Grid><Dialog open renderForm={null} /><Select /><TextField select /><DataGrid rows={[]} /></Grid>;',
        '}',
        '',
      ].join('\n'),
    );
    const report = app.check(['record', 'no-select', 'bootstrap-grid']);

    expect(problemsOf(report, 'record')).toHaveLength(3);
    expect(problemsOf(report, 'no-select')).toHaveLength(2);
    expect(problemsOf(report, 'bootstrap-grid')).toHaveLength(1);
  });

  it('shell, semantic-html, copy and color-tokens: what a component must not carry', () => {
    const app = freshApp();
    app.write(
      'src/components/shared/banner/Banner.component.jsx',
      [
        'export default function Banner() {',
        '  return (',
        '    <div className="left-side-menu" style={{ color: "#ff0000" }}>',
        '      <a href="/items#add-gemstone" aria-hidden="true" />',
        '      <div><div><div>Welcome back</div></div></div>',
        '      <img alt="Company logo" src="/x.png" />',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    );
    const report = app.check(['shell', 'semantic-html', 'copy', 'color-tokens']);

    expect(problemsOf(report, 'shell')).toHaveLength(1);
    expect(problemsOf(report, 'semantic-html')).toHaveLength(1);
    expect(problemsOf(report, 'copy').map((problem) => problem.message)).toEqual([
      expect.stringContaining('Welcome back'),
      expect.stringContaining('alt="Company logo"'),
    ]);
    expect(problemsOf(report, 'color-tokens')).toHaveLength(1);
    expect(report.ok).toBe(false);
    expect(report.warnings).toBe(1);
  });

  it('i18n-parity: a key one dictionary has and the other lacks', () => {
    const app = freshApp();
    const file = path.join(app.root, 'src/i18n/es.js');
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('const es = {', 'const es = {\n  soloEnEspanol: "Hola",'),
    );

    expect(problemsOf(app.check(['i18n-parity']), 'i18n-parity')).toEqual([
      { file: 'src/i18n/en.js', message: 'Missing "soloEnEspanol", which es.js has' },
    ]);
  });

  it('layers: an SDK of a layer the app does not have', () => {
    const app = freshApp();
    const manifestFile = path.join(app.root, 'loom.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, layers: ['base'] }));

    expect(problemsOf(app.check(['layers']), 'layers').length).toBeGreaterThan(0);
  });

  it('no-adminto and secrets: leftovers of the old template and leaked keys', () => {
    const app = freshApp();
    app.write(
      'src/utils/legacy.utils.js',
      '// Adminto v4 helpers\nexport const token = "ghp_0123456789abcdefghijABCDEFGHIJ";\n',
    );
    const sample = path.join(app.root, '.env.sample');
    fs.appendFileSync(sample, 'REPLICATE_API_TOKEN=r8_not-empty\n');
    const report = app.check(['no-adminto', 'secrets']);

    expect(problemsOf(report, 'no-adminto')).toEqual([expect.objectContaining({ file: 'src/utils/legacy.utils.js' })]);
    expect(problemsOf(report, 'secrets').map((problem) => problem.file)).toEqual([
      'src/utils/legacy.utils.js',
      '.env.sample',
    ]);
  });

  it('tests: code without its test, and a test without its code', () => {
    const app = freshApp();
    app.write('src/utils/money.utils.js', 'export const cents = (value) => Math.round(value * 100);\n');
    app.write('tests/utils/gone.utils.test.js', 'it("works", () => {});\n');

    expect(problemsOf(app.check(['tests']), 'tests').map((problem) => problem.file)).toEqual([
      'src/utils/money.utils.js',
      'tests/utils/gone.utils.test.js',
    ]);
  });
});
