import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { LOCAL_MODEL, modelDir } from './files.js';

const sha256Of = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const isVerified = (dir, entry) => {
  const file = path.join(dir, entry.name);
  return fs.existsSync(file) && fs.statSync(file).size === entry.bytes && sha256Of(file) === entry.sha256;
};

/** What is on disk: the folder, whether every file is there and verified, and the bytes still to download. */
export const modelStatus = (env = process.env) => {
  const dir = modelDir(env);
  const missing = LOCAL_MODEL.files.filter((entry) => !isVerified(dir, entry));
  return {
    id: LOCAL_MODEL.id,
    dir,
    installed: missing.length === 0,
    missing: missing.map((entry) => entry.name),
    bytesToDownload: missing.reduce((sum, entry) => sum + entry.bytes, 0),
    bytes: LOCAL_MODEL.files.reduce((sum, entry) => sum + entry.bytes, 0),
  };
};

/** One file: downloaded to <name>.part, checked against its hash, then renamed, so a cut download leaves no file. */
const download = async (dir, entry, fetchImpl, onProgress) => {
  const target = path.join(dir, entry.name);
  const partial = `${target}.part`;
  let response;
  try {
    response = await fetchImpl(entry.url, { signal: AbortSignal.timeout(120000) });
  } catch (error) {
    throw new LoomError(ERROR_CODES.fetch, `Could not download ${entry.name}: ${error.message}`, { url: entry.url });
  }

  if (!response.ok) {
    throw new LoomError(ERROR_CODES.fetch, `Could not download ${entry.name}: HTTP ${response.status}`, {
      url: entry.url,
    });
  }

  const content = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(partial, content);
  const digest = createHash('sha256').update(content).digest('hex');
  if (digest !== entry.sha256) {
    fs.rmSync(partial, { force: true });
    throw new LoomError(ERROR_CODES.fetch, `${entry.name} does not match its pinned SHA-256; nothing was installed`, {
      url: entry.url,
      expected: entry.sha256,
      found: digest,
    });
  }

  fs.renameSync(partial, target);
  onProgress?.({ file: entry.name, bytes: entry.bytes });
};

/** Downloads the files that are missing or do not verify. Never runs on its own: `link-loom ai install` asks for it. */
export const installModel = async ({ env = process.env, fetchImpl = globalThis.fetch, onProgress } = {}) => {
  const dir = modelDir(env);
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of LOCAL_MODEL.files.filter((candidate) => !isVerified(dir, candidate))) {
    await download(dir, entry, fetchImpl, onProgress);
  }

  return modelStatus(env);
};

export const removeModel = (env = process.env) => {
  const dir = modelDir(env);
  fs.rmSync(dir, { recursive: true, force: true });
  return modelStatus(env);
};
