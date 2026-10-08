import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';

import { ERROR_CODES, LoomError } from '../errors.js';

/** Downloads a GitHub repository at `ref` as a tarball and extracts it into `destination` (no git binary needed). */
export const fetchGithubTarball = async ({ repo, ref, destination }) => {
  const url = `https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`;
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new LoomError(ERROR_CODES.fetch, `Could not reach ${url}: ${error.message}`, { url });
  }

  if (!response.ok) {
    throw new LoomError(ERROR_CODES.fetch, `Could not download ${repo}@${ref} (HTTP ${response.status})`, { url });
  }

  fs.mkdirSync(destination, { recursive: true });
  await pipeline(Readable.fromWeb(response.body), tar.x({ cwd: destination, strip: 1 }));
  return destination;
};
