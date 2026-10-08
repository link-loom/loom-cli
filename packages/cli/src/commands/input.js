import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError } from '@link-loom/devkit';

const readSource = (source, cwd, stdin) => {
  if (source === '-') {
    return fs.readFileSync(stdin.fd ?? 0, 'utf8');
  }

  return fs.readFileSync(path.resolve(cwd, source), 'utf8');
};

/** Generator input = the `--input` JSON (file or `-` for stdin), overridden by explicit flags. */
export const resolveInput = ({ global, flags, cwd, stdin = process.stdin }) => {
  if (!global.input || global.input === true) {
    return { ...flags };
  }

  let fromFile;
  try {
    fromFile = JSON.parse(readSource(global.input, cwd, stdin));
  } catch (error) {
    throw new LoomError(ERROR_CODES.usage, `Could not read --input ${global.input}: ${error.message}`);
  }

  return { ...fromFile, ...flags };
};
