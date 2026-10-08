import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// How many packages a fresh project of each kind installs, as measured; a run on this machine refines them.
const KNOWN_SIZES = Object.freeze({ landing: 830, webapp: 1330, service: 400 });

const sizesFile = (env) =>
  path.join(env.LINK_LOOM_CACHE || path.join(os.homedir(), '.cache', 'link-loom'), 'install-sizes.json');

const readSizes = (env) => {
  try {
    return JSON.parse(fs.readFileSync(sizesFile(env), 'utf8'));
  } catch {
    return {};
  }
};

/** The packages a project of this kind (and layers) is expected to install: the last measure, or a known size. */
export const estimateInstall = ({ target, layers = [], env = process.env }) =>
  readSizes(env)[[target, ...[...layers].sort()].join(':')] || KNOWN_SIZES[target] || 0;

/** Remembers how many packages a project of this kind installed, for the next estimate. Best effort. */
export const recordInstall = ({ target, layers = [], count, env = process.env }) => {
  if (!count) return;
  try {
    const sizes = { ...readSizes(env), [[target, ...[...layers].sort()].join(':')]: count };
    fs.mkdirSync(path.dirname(sizesFile(env)), { recursive: true });
    fs.writeFileSync(sizesFile(env), `${JSON.stringify(sizes, null, 2)}\n`);
  } catch {
    // An estimate that is not saved only makes the next bar a little less exact.
  }
};
