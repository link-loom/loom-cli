#!/usr/bin/env node
/**
 * Lockstep release: bumps the root and every workspace to the same version, aligns the internal
 * @link-loom/* dependencies, refreshes the lockfile, commits "<version>", tags "v<version>" and pushes the tag.
 * GitHub Actions publishes the packages from that tag (see .github/workflows/publish.yml).
 *
 *   node scripts/release.mjs [patch|minor|major|prerelease]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUMPS = new Set(['patch', 'minor', 'major', 'prerelease']);
const PRERELEASE_ID = 'alpha';

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

const main = () => {
  const bump = process.argv[2] || 'patch';
  if (!BUMPS.has(bump)) {
    throw new Error(`Usage: release.mjs [${[...BUMPS].join('|')}]`);
  }

  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT }).toString().trim();
  if (status) {
    throw new Error('The working tree is not clean; commit or stash first');
  }

  const rootFile = path.join(ROOT, 'package.json');
  const rootPackage = read(rootFile);
  const version = nextVersion(rootPackage.version, bump);

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
  }

  run('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund']);
  run('git', ['commit', '-am', version]);
  run('git', ['tag', `v${version}`]);
  run('git', ['push', '--follow-tags']);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
