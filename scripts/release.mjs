#!/usr/bin/env node
/**
 * Lockstep release: bumps the root and every workspace to the same version, aligns the internal
 * @link-loom/* dependencies and the CLI range generated projects get (each collection's stack.json), refreshes the
 * lockfile, commits "<version>", tags "v<version>" and pushes the tag. GitHub Actions publishes the packages from that
 * tag (see .github/workflows/publish.yml).
 *
 *   node scripts/release.mjs [patch|minor|major|prerelease] [--no-push]
 *   node scripts/release.mjs tag      tags the current version on HEAD, without bumping or pushing
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUMPS = new Set(['patch', 'minor', 'major', 'prerelease']);
const TAG_ONLY = 'tag';
const PRERELEASE_ID = 'alpha';

const CLI_PACKAGE = '@link-loom/cli';

const run = (command, args) => execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' });
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, json) => fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);

export const nextVersion = (current, bump) => {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Unsupported version: ${current}`);
  }

  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const prerelease = match[4] ? { id: match[4], number: Number(match[5]) } : null;

  if (bump === 'prerelease') {
    return prerelease
      ? `${major}.${minor}.${patch}-${prerelease.id}.${prerelease.number + 1}`
      : `${major}.${minor}.${patch + 1}-${PRERELEASE_ID}.0`;
  }

  if (bump === 'patch') {
    return prerelease ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
  }

  if (bump === 'minor') {
    return prerelease && patch === 0 ? `${major}.${minor}.0` : `${major}.${minor + 1}.0`;
  }

  return prerelease && minor === 0 && patch === 0 ? `${major}.0.0` : `${major + 1}.0.0`;
};

/** A collection's stack with the CLI range of the projects it generates set to the released version. */
export const withCliRange = (stack, version) =>
  Object.fromEntries(
    Object.entries(stack).map(([section, packages]) => [
      section,
      CLI_PACKAGE in packages ? { ...packages, [CLI_PACKAGE]: `^${version}` } : packages,
    ]),
  );

/** The tag of a lockstep version: `v<version>`, once the root and every workspace agree on it. */
export const releaseTag = (rootPackage, workspacePackages) => {
  const behind = workspacePackages.filter((pkg) => pkg.version !== rootPackage.version);
  if (behind.length) {
    throw new Error(
      `Not every package is at ${rootPackage.version}: ${behind.map((pkg) => `${pkg.name} ${pkg.version}`).join(', ')}`,
    );
  }

  return `v${rootPackage.version}`;
};

const assertClean = () => {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT }).toString().trim();
  if (status) {
    throw new Error('The working tree is not clean; commit or stash first');
  }
};

// Tags what is already released in package.json (a version committed without its tag). Pushing it publishes.
const tagCurrentVersion = () => {
  assertClean();
  const rootPackage = read(path.join(ROOT, 'package.json'));
  const workspacePackages = rootPackage.workspaces.map((workspace) => read(path.join(ROOT, workspace, 'package.json')));
  const tag = releaseTag(rootPackage, workspacePackages);
  const existing = execFileSync('git', ['tag', '--list', tag], { cwd: ROOT }).toString().trim();
  if (existing) {
    throw new Error(`${tag} already exists`);
  }

  run('git', ['tag', '-a', tag, '-m', rootPackage.version]);
  console.log(`Tagged ${tag}. \`git push origin ${tag}\` publishes it to npm.`);
};

const main = () => {
  const action = process.argv[2] || 'patch';
  if (action === TAG_ONLY) {
    tagCurrentVersion();
    return;
  }

  if (!BUMPS.has(action)) {
    throw new Error(`Usage: release.mjs [${[...BUMPS].join('|')}|${TAG_ONLY}]`);
  }

  assertClean();

  const rootFile = path.join(ROOT, 'package.json');
  const rootPackage = read(rootFile);
  const version = nextVersion(rootPackage.version, action);

  write(rootFile, { ...rootPackage, version });
  for (const workspace of rootPackage.workspaces) {
    const file = path.join(ROOT, workspace, 'package.json');
    const pkg = read(file);
    const dependencies = Object.fromEntries(
      Object.entries(pkg.dependencies || {}).map(([name, range]) => [
        name,
        name.startsWith('@link-loom/') ? version : range,
      ]),
    );
    write(file, { ...pkg, version, dependencies });

    const stackFile = path.join(ROOT, workspace, 'src', 'stack.json');
    if (fs.existsSync(stackFile)) write(stackFile, withCliRange(read(stackFile), version));
  }

  run('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund']);
  run('git', ['commit', '-am', version]);
  // Annotated, as npm version makes them: `git push --follow-tags` (and GitHub Desktop) only push those.
  run('git', ['tag', '-a', `v${version}`, '-m', version]);
  if (process.argv.includes('--no-push')) return;
  run('git', ['push', '--follow-tags']);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
