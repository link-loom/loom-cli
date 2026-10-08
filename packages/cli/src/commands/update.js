import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ERROR_CODES, LoomError, VirtualTree, applyTree, stringifyJson } from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { getCollection } from '../registry/collections.js';
import { npmInstall } from './install.js';
import { estimateInstall, recordInstall } from './install-sizes.js';
import { PROJECT_COLLECTIONS, PROJECT_FILE, findProject } from './project.js';

// The packages `update` owns: the Link Loom stack the collection pins, and nothing else of the project.
const STACK_SCOPES = /^@(link-loom|veripass|sommatic|vectry)\//;

const parse = (version) => {
  const [core, prerelease = ''] = String(version)
    .replace(/^[^\d]*/, '')
    .split('-');
  return { parts: core.split('.').map(Number), prerelease };
};

/** Semver order for the versions a collection uses (x.y.z and x.y.z-tag.n). */
export const compareVersions = (left, right) => {
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a.parts[index] || 0) !== (b.parts[index] || 0)) {
      return (a.parts[index] || 0) - (b.parts[index] || 0);
    }
  }

  if (a.prerelease === b.prerelease) {
    return 0;
  }

  if (!a.prerelease || !b.prerelease) {
    return a.prerelease ? -1 : 1;
  }

  return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true });
};

/** Each stack dependency of package.json whose range is not the one the collection asks for. */
const outdatedOf = (packageJson, stack) =>
  ['dependencies', 'devDependencies'].flatMap((section) =>
    Object.entries(packageJson[section] || {})
      .filter(([name]) => STACK_SCOPES.test(name) || name === '@link-loom/cli')
      .map(([name, range]) => ({ section, name, range, wanted: stack[section]?.[name] }))
      .filter((entry) => entry.wanted && entry.wanted !== entry.range),
  );

/** The lock without the entries of these packages (top level and nested), so npm resolves them again cleanly. */
const lockWithout = (lock, names) => {
  const pattern = new RegExp(`(^|/)node_modules/(${names.map((name) => name.replace('/', '\\/')).join('|')})$`);
  return {
    ...lock,
    packages: Object.fromEntries(Object.entries(lock.packages || {}).filter(([key]) => !pattern.test(key))),
  };
};

const runStep = (projectDir, command, args) => {
  const outcome = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8' });
  return { ok: outcome.status === 0, output: `${outcome.stdout}\n${outcome.stderr}`.slice(-2000) };
};

/**
 * `link-loom update [--check]`: brings the project to the stack and conventions of the CLI's collection. Sets the
 * ranges of the Link Loom packages, drops their stale lock entries (what makes npm fail with ERESOLVE), runs the
 * collection's migrations from the project's version to this one, installs, and ends with `check` and the build.
 * `--check` only reports what would change.
 */
export const runUpdate = async ({ input = {}, global = {}, cwd, onStep = () => {}, onProgress }) => {
  const project = findProject(cwd);
  const collectionName = PROJECT_COLLECTIONS[project.manifest.type];
  const collection = getCollection(collectionName);
  if (!collection.stackPath) {
    throw new LoomError(ERROR_CODES.notAvailable, `${collectionName} has no stack to update to`);
  }

  const stack = JSON.parse(fs.readFileSync(collection.stackPath, 'utf8'));
  const tree = new VirtualTree({ root: project.root });
  const packageJson = JSON.parse(tree.read('package.json'));
  const outdated = outdatedOf(packageJson, stack);
  const from = project.manifest.collection?.version || '0.0.0';
  const migrations = collection.migrations
    .filter(
      (migration) =>
        compareVersions(migration.version, from) > 0 && compareVersions(migration.version, collection.version) <= 0,
    )
    .sort((left, right) => compareVersions(left.version, right.version));
  const report = {
    collection: { from, to: collection.version },
    packages: outdated.map(({ name, range, wanted }) => ({ name, from: range, to: wanted })),
    migrations: migrations.map((migration) => migration.version),
  };

  if (input.check || global.check) {
    return createResult({ command: 'update --check', project: { root: project.root }, data: report });
  }

  if (!outdated.length && !migrations.length && compareVersions(from, collection.version) === 0) {
    return createResult({
      command: 'update',
      project: { root: project.root },
      data: report,
      warnings: ['Already up to date'],
    });
  }

  const next = structuredClone(packageJson);
  for (const { section, name, wanted } of outdated) {
    next[section][name] = wanted;
  }
  tree.overwrite('package.json', stringifyJson(next));

  const lockText = tree.read('package-lock.json');
  if (lockText && outdated.length) {
    tree.overwrite(
      'package-lock.json',
      stringifyJson(
        lockWithout(
          JSON.parse(lockText),
          outdated.map((entry) => entry.name),
        ),
      ),
    );
  }

  for (const migration of migrations) {
    const migrate = (await import(pathToFileURL(migration.path).href)).default;
    await migrate(tree, { project: project.manifest });
  }

  tree.overwrite(
    PROJECT_FILE,
    stringifyJson({ ...project.manifest, collection: { ...project.manifest.collection, version: collection.version } }),
  );
  const result = { command: 'update', project: { root: project.root }, plan: tree.plan(), data: report };
  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  if (!global.yes) {
    throw new LoomError(
      ERROR_CODES.confirmationRequired,
      'update changes package.json and the lock; review the plan and pass --yes',
      {
        plan: result.plan,
      },
    );
  }

  onStep('write');
  applyTree(tree);
  if (global.install === false) {
    return createResult({ ...result, next: ['npm install', 'npx link-loom check', 'npm run build'] });
  }

  onStep('install');
  const target = project.manifest.type;
  const layers = project.manifest.layers || [];
  const count = await npmInstall(project.root, {
    onProgress: onProgress && ((progress) => onProgress('install', progress)),
    estimate: onProgress ? estimateInstall({ target, layers }) : 0,
  });
  if (count) recordInstall({ target, layers, count });
  onStep('verify');
  const verification = [
    {
      step: 'check',
      ...runStep(project.root, process.execPath, [path.join(import.meta.dirname, '../../bin/link-loom.js'), 'check']),
    },
    { step: 'build', ...runStep(project.root, 'npm', ['run', 'build']) },
  ];
  const failed = verification.filter((step) => !step.ok);
  return createResult({
    ...result,
    data: { ...report, verification: verification.map(({ step, ok }) => ({ step, ok })) },
    warnings: failed.map((step) => `${step.step} failed after the update:\n${step.output}`),
  });
};
