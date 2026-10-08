#!/usr/bin/env node
/**
 * Creates a webapp for every layer combination, adds one piece of every `add` generator, and runs the gate on each:
 * lint, `link-loom check`, tests and build.
 *
 *   node scripts/e2e/webapp-matrix.mjs [--out <dir>] [--only all,base] [--no-pieces]
 *
 * Environment:
 *   LOOM_E2E_TARBALLS     folder with SDK tarballs (`npm pack` output) to install instead of the registry, for SDK
 *                         versions not published yet
 *   LOOM_E2E_NODE_MODULES a node_modules folder (of the "all" combination) to link instead of installing each time;
 *                         every other combination needs a subset of it
 *
 * Exit code 0 when every combination passes; prints one JSON line per combination.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(ROOT, 'packages/cli/bin/link-loom.js');

export const COMBINATIONS = Object.freeze({
  all: [],
  'no-command-center': ['--no-command-center'],
  'no-stoneos': ['--no-stoneos'],
  base: ['--no-stoneos', '--no-command-center', '--no-signup'],
});

const GATES = Object.freeze(['lint', 'check', 'test', 'build']);

/** One piece per `add` generator, as an agent would ask for it; `layer` skips it where the layer is missing. */
export const PIECES = Object.freeze([
  {
    args: [
      'entity',
      '--domain',
      'inventory',
      '--entity',
      'product',
      '--fields',
      'name:text:required,sku:text:required:list,price:number,status:options=active|archived:required,released_on:date,notes:longtext,featured:boolean,contact:email,website:url',
      '--singular-es',
      'Producto',
      '--plural-es',
      'Productos',
      '--field-labels-es',
      'name=Nombre,sku=SKU,price=Precio,status=Estado,status.active=Activo,status.archived=Archivado,released_on=Fecha de lanzamiento,notes=Notas,featured=Destacado,contact=Contacto,website=Sitio web',
      '--actions',
      'quickview,edit,open-page,open-new-tab,copy-id,copy-link,delete',
      '--custom-actions',
      'archive:call',
      '--action-labels-es',
      'archive=Archivar',
      '--icon',
      'inventory',
      '--quick-add',
    ],
  },
  {
    args: [
      'entity',
      '--domain',
      'crm',
      '--entity',
      'contact',
      '--fields',
      'name:text:required,email:email',
      '--list',
      'cards',
      '--singular-es',
      'Contacto',
      '--plural-es',
      'Contactos',
      '--field-labels-es',
      'name=Nombre,email=Correo',
    ],
  },
  {
    args: [
      'entity',
      '--domain',
      'crm',
      '--entity',
      'company',
      '--fields',
      'name:text:required',
      '--list',
      'compact',
      '--actions',
      'quickview,copy-link',
      '--singular-es',
      'Empresa',
      '--plural-es',
      'Empresas',
      '--gender-es',
      'f',
      '--field-labels-es',
      'name=Nombre',
    ],
  },
  {
    args: [
      'page',
      '--domain',
      'reports',
      '--name',
      'stock-summary',
      '--title-en',
      'Stock summary',
      '--title-es',
      'Resumen de inventario',
      '--navigation',
      '--icon',
      'chart',
    ],
  },
  {
    args: [
      'page',
      '--domain',
      'management',
      '--name',
      'audit-log',
      '--title-en',
      'Audit log',
      '--title-es',
      'Registro de auditoría',
      '--section',
      'advanced',
    ],
  },
  { args: ['component', '--name', 'StockGauge', '--domain', 'reports'] },
  { args: ['service', '--domain', 'reports', '--entity', 'snapshot', '--calls', 'refresh'] },
  { args: ['hook', '--name', 'useStockFilters'] },
  {
    args: [
      'nav-item',
      '--id',
      'help-desk',
      '--label-en',
      'Help desk',
      '--label-es',
      'Mesa de ayuda',
      '--to',
      '/overview',
      '--icon',
      'mail',
    ],
  },
  {
    args: [
      'settings-section',
      '--id',
      'audit-log',
      '--title-en',
      'Audit log',
      '--title-es',
      'Registro de auditoría',
      '--description-en',
      'Who changed what, and when.',
      '--description-es',
      'Quién cambió qué, y cuándo.',
      '--to',
      '/management/audit-log',
      '--color',
      'purple',
    ],
  },
  {
    layer: 'stoneos',
    args: [
      'platform-section',
      '--platform',
      'veripass',
      '--id',
      'users',
      '--title-en',
      'Users',
      '--title-es',
      'Usuarios',
      '--description-en',
      'The people of your organization.',
      '--description-es',
      'Las personas de tu organización.',
      '--to',
      '/identity/users',
      '--icon',
      'people',
    ],
  },
  { args: ['copy', '--key', 'reports.lowStock', '--en', 'Low stock', '--es', 'Inventario bajo'] },
  { args: ['feature', '--name', 'images'] },
]);

const argValue = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const tarballFor = (directory, packageName) => {
  const prefix = packageName.replace('@', '').replace('/', '-');
  return fs.readdirSync(directory).find((file) => file.startsWith(`${prefix}-`) && file.endsWith('.tgz'));
};

/** Points the SDK dependencies at local tarballs and drops the CLI itself, which is not on the registry either. */
const useLocalTarballs = (projectDir, tarballsDir) => {
  const file = path.join(projectDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const overrides = {};
  for (const name of Object.keys(manifest.dependencies)) {
    const tarball = tarballFor(tarballsDir, name);
    if (!tarball) {
      continue;
    }

    manifest.dependencies[name] = `file:${path.join(tarballsDir, tarball)}`;
    overrides[name] = manifest.dependencies[name];
  }

  delete manifest.devDependencies['@link-loom/cli'];
  manifest.overrides = overrides;
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
};

const addPieces = (projectDir, flags) =>
  PIECES.filter((piece) => !piece.layer || !flags.includes(`--no-${piece.layer}`)).map((piece) => {
    const outcome = spawnSync(process.execPath, [CLI, 'add', ...piece.args, '--yes', '--json'], {
      cwd: projectDir,
      encoding: 'utf8',
    });
    return { piece: piece.args.slice(0, 3).join(' '), ok: outcome.status === 0, output: outcome.stdout.slice(-2000) };
  });

// `check` runs the CLI of this checkout: the project's own devDependency is dropped until it is on the registry.
const gateCommand = (gate) => (gate === 'check' ? [process.execPath, [CLI, 'check']] : ['npm', ['run', gate]]);

const runGate = (projectDir, gate) => {
  const [command, args] = gateCommand(gate);
  const outcome = spawnSync(command, args, {
    cwd: projectDir,
    encoding: 'utf8',
    env: { ...process.env, CI: '' },
  });
  return {
    gate,
    ok: outcome.status === 0,
    output: outcome.status === 0 ? '' : `${outcome.stdout}\n${outcome.stderr}`.slice(-4000),
  };
};

const runCombination = (name, flags, outDir, { pieces = true } = {}) => {
  const workDir = path.join(outDir, name);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  execFileSync(
    process.execPath,
    [CLI, 'create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', ...flags],
    {
      cwd: workDir,
      stdio: 'pipe',
    },
  );

  const projectDir = path.join(workDir, 'acme-workspace');
  if (process.env.LOOM_E2E_TARBALLS) {
    useLocalTarballs(projectDir, process.env.LOOM_E2E_TARBALLS);
  }

  if (process.env.LOOM_E2E_NODE_MODULES) {
    fs.symlinkSync(process.env.LOOM_E2E_NODE_MODULES, path.join(projectDir, 'node_modules'), 'dir');
  } else {
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: projectDir, stdio: 'pipe' });
  }

  const added = pieces ? addPieces(projectDir, flags) : [];
  const failedPieces = added
    .filter((piece) => !piece.ok)
    .map((piece) => ({ gate: `add ${piece.piece}`, ok: false, output: piece.output }));
  const gates = [...failedPieces, ...GATES.map((gate) => runGate(projectDir, gate))];
  return { combination: name, ok: gates.every((gate) => gate.ok), pieces: added.length, gates };
};

const main = () => {
  const outDir = path.resolve(argValue('out') || fs.mkdtempSync(path.join(os.tmpdir(), 'loom-webapp-matrix-')));
  const only = argValue('only')?.split(',');
  const selected = Object.entries(COMBINATIONS).filter(([name]) => !only || only.includes(name));
  const pieces = !process.argv.includes('--no-pieces');
  const results = selected.map(([name, flags]) => runCombination(name, flags, outDir, { pieces }));

  for (const result of results) {
    process.stdout.write(
      `${JSON.stringify({ ...result, gates: result.gates.map(({ gate, ok }) => ({ gate, ok })) })}\n`,
    );
    for (const failed of result.gates.filter((gate) => !gate.ok)) {
      process.stderr.write(`\n--- ${result.combination} · ${failed.gate} ---\n${failed.output}\n`);
    }
  }

  process.exitCode = results.every((result) => result.ok) ? 0 : 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
