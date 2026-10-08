import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

const OUTPUT_TAIL = 20;
const HALF = 0.5;
const RESOLVING_CAP = 0.98;
// `npm http fetch GET 200 https://registry/<name> 31ms`: a package's metadata (tarballs end in .tgz).
const METADATA_FETCH = /npm http fetch GET \d+ \S+?\/((?:@[^/\s]+(?:\/|%2[fF]))?[^/\s]+)(?:\s|$)/;
const POLL_MS = 250;

export const INSTALL_PHASES = Object.freeze({ resolving: 'resolving', installing: 'installing' });

const npm = (directory, args, onLine = () => {}) =>
  new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, [...args, '--no-audit', '--no-fund'], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = [];
    const collect = (chunk) => {
      const lines = chunk.toString().split('\n');
      output.push(...lines);
      lines.forEach(onLine);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) =>
      reject(new LoomError(ERROR_CODES.install, `npm install could not start: ${error.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const tail = output.filter(Boolean).slice(-OUTPUT_TAIL);
      reject(new LoomError(ERROR_CODES.install, `npm install failed (exit ${code})`, { directory, output: tail }));
    });
  });

// A package the lockfile pins for another operating system or CPU is never installed here.
const fitsThisMachine = (entry) => {
  const fits = (list, value) =>
    !list || list.includes(value) || (list.every((item) => item.startsWith('!')) && !list.includes(`!${value}`));
  return fits(entry.os, process.platform) && fits(entry.cpu, process.arch);
};

/** The folders npm will fill, from the lockfile: every package of the tree that this machine installs. */
export const expectedPackages = (directory) => {
  const lockFile = path.join(directory, 'package-lock.json');
  if (!fs.existsSync(lockFile)) return [];
  const { packages = {} } = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  return Object.entries(packages)
    .filter(([key, entry]) => key.startsWith('node_modules/') && !entry.link && fitsThisMachine(entry))
    .map(([key]) => key);
};

const installedCount = (directory, expected) =>
  expected.filter((key) => fs.existsSync(path.join(directory, key, 'package.json'))).length;

/**
 * Runs `npm install` in the new project; output is kept and shown only if it fails. With `onProgress` it first
 * resolves the tree (`--package-lock-only`, counting the packages it finds), which says how many packages there are,
 * then installs and reports how many of them are already in node_modules: `{ phase, found, done, total, share }`,
 * `share` being the whole install from 0 to 1 (`estimate`, the packages a project like this one had, sizes the first
 * half). Resolves with how many packages it installed.
 */
export const npmInstall = async (directory, { onProgress, estimate = 0 } = {}) => {
  if (!onProgress) {
    await npm(directory, ['install']);
    return null;
  }

  // One bar for the whole install, so it never starts over: the first half is the tree being worked out (packages
  // found against the estimate, never past 49%), the second the packages in place against the real total.
  const resolving = (found) => ({
    phase: INSTALL_PHASES.resolving,
    found,
    share: estimate ? Math.min(found / estimate, RESOLVING_CAP) * HALF : null,
  });
  const installing = (done, total) => ({
    phase: INSTALL_PHASES.installing,
    done,
    total,
    share: HALF + (total ? done / total : 1) * HALF,
  });

  // While npm works out the tree it fetches each package's metadata once: counting them shows it moving.
  const found = new Set();
  onProgress(resolving(0));
  await npm(directory, ['install', '--package-lock-only', '--loglevel=http'], (line) => {
    const name = METADATA_FETCH.exec(line)?.[1];
    if (!name || name.endsWith('.tgz') || found.has(name)) return;
    found.add(name);
    onProgress(resolving(found.size));
  });
  const expected = expectedPackages(directory);
  const report = () => onProgress(installing(installedCount(directory, expected), expected.length));
  report();
  const timer = setInterval(report, POLL_MS);
  try {
    await npm(directory, ['install']);
  } finally {
    clearInterval(timer);
  }

  onProgress(installing(expected.length, expected.length));
  return expected.length;
};
