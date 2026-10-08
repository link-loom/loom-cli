import { nextVersion, releaseTag, withCliRange } from '../release.mjs';

describe('nextVersion', () => {
  it('bumps stable versions', () => {
    expect(nextVersion('3.0.0', 'patch')).toBe('3.0.1');
    expect(nextVersion('3.0.1', 'minor')).toBe('3.1.0');
    expect(nextVersion('3.1.0', 'major')).toBe('4.0.0');
  });

  it('moves through and out of prereleases', () => {
    expect(nextVersion('3.0.0-alpha.0', 'prerelease')).toBe('3.0.0-alpha.1');
    expect(nextVersion('3.0.0-alpha.1', 'patch')).toBe('3.0.0');
    expect(nextVersion('3.0.0', 'prerelease')).toBe('3.0.1-alpha.0');
  });

  it('rejects versions it does not understand', () => {
    expect(() => nextVersion('banana', 'patch')).toThrow('Unsupported version');
  });
});

describe('releaseTag', () => {
  it('names the tag of a version every package shares', () => {
    expect(releaseTag({ version: '3.0.0-alpha.0' }, [{ name: '@link-loom/cli', version: '3.0.0-alpha.0' }])).toBe(
      'v3.0.0-alpha.0',
    );
  });

  it('refuses to tag while a package is at another version', () => {
    expect(() => releaseTag({ version: '3.0.1' }, [{ name: '@link-loom/cli', version: '3.0.0' }])).toThrow(
      'Not every package is at 3.0.1: @link-loom/cli 3.0.0',
    );
  });
});

describe('withCliRange', () => {
  it('moves the CLI range of generated projects to the released version and leaves the rest', () => {
    const stack = {
      dependencies: { react: '^19.2.0' },
      devDependencies: { '@link-loom/cli': '^3.0.0-alpha.0', vite: '^7.1.7' },
    };

    expect(withCliRange(stack, '3.0.0')).toEqual({
      dependencies: { react: '^19.2.0' },
      devDependencies: { '@link-loom/cli': '^3.0.0', vite: '^7.1.7' },
    });
  });
});
