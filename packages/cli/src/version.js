import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const CLI_PACKAGE = require('../package.json');
export const CLI_VERSION = CLI_PACKAGE.version;
