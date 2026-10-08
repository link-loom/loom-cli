import fs from 'node:fs';
import path from 'node:path';

import { expectedPackages } from '../src/commands/install.js';
import { estimateInstall, recordInstall } from '../src/commands/install-sizes.js';
import { makeTempDir } from './helpers.js';

describe('install progress', () => {
  it('counts the packages of the lockfile this machine installs', () => {
    const directory = makeTempDir();
    const other = process.platform === 'win32' ? 'linux' : 'win32';
    fs.writeFileSync(
      path.join(directory, 'package-lock.json'),
      JSON.stringify({
        packages: {
          '': { name: 'demo' },
          'node_modules/react': { version: '19.0.0' },
          'node_modules/a/node_modules/b': { version: '1.0.0' },
          [`node_modules/@esbuild/${other}-x64`]: { version: '0.25.0', os: [other] },
          'node_modules/local': { link: true },
        },
      }),
    );

    expect(expectedPackages(directory)).toEqual(['node_modules/react', 'node_modules/a/node_modules/b']);
    expect(expectedPackages(makeTempDir())).toEqual([]);
  });

  it('estimates an install from the last one of the same kind, or from a known size', () => {
    const env = { LINK_LOOM_CACHE: makeTempDir() };

    expect(estimateInstall({ target: 'landing', layers: ['base', 'blog'], env })).toBe(830);
    recordInstall({ target: 'landing', layers: ['blog', 'base'], count: 812, env });
    expect(estimateInstall({ target: 'landing', layers: ['base', 'blog'], env })).toBe(812);
    expect(estimateInstall({ target: 'unknown', env })).toBe(0);
  });
});
