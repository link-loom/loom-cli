#!/usr/bin/env node
/**
 * Creates a landing for every layer combination, adds one piece of every `add` generator, and runs the gate on
 * each: `link-loom check`, `astro check` and the build.
 *
 *   node scripts/e2e/landing-matrix.mjs [--out <dir>] [--only all,base] [--no-pieces]
 *
 * Environment:
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
  'no-editor': ['--no-editor'],
  'no-search': ['--no-search'],
  base: ['--no-blog', '--no-editor', '--no-search'],
});

const GATES = Object.freeze(['check', 'astro check', 'build']);

/** One piece per `add` generator, as an agent would ask for it; `layer` skips it where the layer is missing. */
export const PIECES = Object.freeze([
  { args: ['page', '--path', '/pricing', '--title-en', 'Pricing', '--title-es', 'Precios', '--nav', 'header'] },
  {
    args: ['page', '--path', '/company', '--title-en', 'Company', '--title-es', 'Compañía', '--nav', 'footer:company'],
  },
  {
    args: [
      'section',
      '--page',
      'home',
      '--kind',
      'cards',
      '--id',
      'governance',
      '--tone',
      'dark',
      '--title-en',
      'Attributable, reconstructible, auditable.',
      '--title-es',
      'Atribuible, reconstruible, auditable.',
      '--items-en',
      'Who|Every action has an author.',
      'Why|Every decision keeps its reason.',
      '--items-es',
      'Quién|Cada acción tiene autor.',
      'Por qué|Cada decisión guarda su razón.',
      '--icons',
      'verified-user,visibility',
    ],
  },
  { args: ['section', '--page', 'home', '--kind', 'logos', '--logos', 'Acme=/brand/favicon.svg'] },
  { args: ['section', '--page', 'home', '--kind', 'faq'] },
  { args: ['section', '--page', 'pricing', '--kind', 'split', '--id', 'plans'] },
  { args: ['section', '--page', 'company', '--kind', 'prose', '--id', 'story'] },
  {
    layer: 'blog',
    args: ['blog-post', '--slug', 'why-one-board', '--title-en', 'Why one board', '--title-es', 'Por qué un tablero'],
  },
  {
    args: [
      'copy',
      '--key',
      'home.hero.deck',
      '--en',
      'One place for the work.',
      '--es',
      'Un solo lugar para el trabajo.',
      '--replace',
    ],
  },
]);

const argValue = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

/** The CLI itself is not on the registry yet: `check` runs this checkout's, so the project drops its devDependency. */
const dropCli = (projectDir) => {
  const file = path.join(projectDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete manifest.devDependencies['@link-loom/cli'];
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

const gateCommand = (gate) => {
  if (gate === 'check') return [process.execPath, [CLI, 'check']];
  return gate === 'astro check' ? ['npx', ['astro', 'check']] : ['npx', ['astro', 'build']];
};

const runGate = (projectDir, gate) => {
  const [command, args] = gateCommand(gate);
  const outcome = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8', env: { ...process.env, CI: '' } });
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
    [
      CLI,
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
      ...flags,
    ],
    { cwd: workDir, stdio: 'pipe' },
  );

  const projectDir = path.join(workDir, 'acme');
  dropCli(projectDir);
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
  const outDir = path.resolve(argValue('out') || fs.mkdtempSync(path.join(os.tmpdir(), 'loom-landing-matrix-')));
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

main();
