import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from '../src/main.js';

export const SERVICE_TEMPLATE = fileURLToPath(
  new URL('../../node-generators/tests/fixtures/loom-svc-js-mini', import.meta.url),
);

export const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'loom-cli-'));

const memoryStream = () => {
  const stream = {
    isTTY: false,
    data: '',
    write(chunk) {
      stream.data += chunk;
      return true;
    },
  };
  return stream;
};

/** Runs the CLI in-process as an agent would: no TTY, captured stdout and stderr. */
export const runCli = async (argv, { env = {} } = {}) => {
  const stdout = memoryStream();
  const stderr = memoryStream();
  const code = await run(argv, { stdout, stderr, stdin: { isTTY: false }, env });
  return { code, stdout: stdout.data, stderr: stderr.data, json: () => JSON.parse(stdout.data) };
};

/** The steps of the progress events a run wrote on stderr with --json, in order. */
export const steps = (stderr) =>
  stderr
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line).step);

export const waitFor = async (predicate, { timeout = 5000, interval = 20 } = {}) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) {
      throw new Error('waitFor: condition not met in time');
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};
