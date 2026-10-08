#!/usr/bin/env node
/**
 * Publishes what an evaluation needs to the local registry (evals/registry/config.yaml): every package of this
 * monorepo, and the SDK tarballs of `--tarballs <dir>` at the versions the generated package.json asks for.
 *
 *   node evals/registry.mjs --tarballs <dir> [--registry http://localhost:4873]
 *
 * Nothing reaches npmjs: the registry serves these packages locally and proxies only the rest. `--replace` unpublishes
 * a version that is already there first (a tarball rebuilt without a version bump).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/react-generators/src/stack.json'), 'utf8'));
const MONOREPO_PACKAGES = ['devkit', 'node-generators', 'astro-generators', 'react-generators', 'migrate', 'cli'];

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const registry = argValue('registry', 'http://localhost:4873');
const tarballs = argValue('tarballs');

/** A throwaway npm config with a token of the local registry (its users are created on demand). */
const userConfig = () => {
  // A new user is created; an existing one logs in with basic auth.
  const basic = Buffer.from('loom-eval:loom-eval').toString('base64');
  const response = execFileSync('curl', [
    '-s',
    '-XPUT',
    '-H',
    'Content-Type: application/json',
    '-H',
    `Authorization: Basic ${basic}`,
    '-d',
    JSON.stringify({ name: 'loom-eval', password: 'loom-eval' }),
    `${registry}/-/user/org.couchdb.user:loom-eval`,
  ]).toString();
  const { token } = JSON.parse(response);
  if (!token) {
    throw new Error(`The registry gave no token: ${response}`);
  }

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loom-eval-npmrc-')), '.npmrc');
  fs.writeFileSync(file, `registry=${registry}/\n${registry.replace(/^https?:/, '')}/:_authToken=${token}\n`);
  return file;
};

const replace = process.argv.includes('--replace');

const publish = (directory, npmrc) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (replace) {
    spawnSync('npm', [
      'unpublish',
      `${manifest.name}@${manifest.version}`,
      '--force',
      '--registry',
      registry,
      '--userconfig',
      npmrc,
    ]);
  }

  try {
    execFileSync('npm', ['publish', directory, '--registry', registry, '--userconfig', npmrc, '--tag', 'latest'], {
      stdio: 'pipe',
    });
    process.stdout.write(`published ${manifest.name}@${manifest.version}\n`);
  } catch (error) {
    const message = `${error.stderr || error.message}`;
    if (!/previously published|cannot publish over/i.test(message)) {
      throw error;
    }

    process.stdout.write(`already there ${manifest.name}@${manifest.version}\n`);
  }
};

/** A tarball unpacked with the version the stack asks for (`^1.1.79` publishes 1.1.79). */
const unpackAt = (tarball) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-eval-pkg-'));
  execFileSync('tar', ['-xzf', tarball, '-C', directory]);
  const packageDir = path.join(directory, 'package');
  const file = path.join(packageDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const wanted = STACK.dependencies[manifest.name]?.replace(/^[\^~]/, '');
  if (wanted) {
    fs.writeFileSync(file, `${JSON.stringify({ ...manifest, version: wanted }, null, 2)}\n`);
  }

  return packageDir;
};

const main = () => {
  const npmrc = userConfig();
  for (const name of MONOREPO_PACKAGES) {
    publish(path.join(ROOT, 'packages', name), npmrc);
  }

  if (!tarballs) {
    return;
  }

  for (const tarball of fs.readdirSync(tarballs).filter((file) => file.endsWith('.tgz'))) {
    publish(unpackAt(path.join(tarballs, tarball)), npmrc);
  }
};

main();
