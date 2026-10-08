import { nextVersion } from '../release.mjs';

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
