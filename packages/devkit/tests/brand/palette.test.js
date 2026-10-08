import { BRAND_PRESETS, DEFAULT_BRAND, brandWarnings, randomBrand, resolveBrand } from '../../src/brand/palette.js';
import { contrastRatio } from '../../src/brand/color.js';

describe('brand palette', () => {
  it("defaults to Mi Retail's colours", () => {
    expect(resolveBrand()).toEqual(DEFAULT_BRAND);
  });

  it('derives the logo area from a new header unless it is given', () => {
    const brand = resolveBrand({ colors: { header: '#1f4e79' } });

    expect(brand.header).toBe('#1f4e79');
    expect(brand.logoArea).not.toBe(DEFAULT_BRAND.logoArea);
    expect(resolveBrand({ colors: { header: '#1f4e79', logoArea: '#123456' } }).logoArea).toBe('#123456');
  });

  it('lets the header follow a new primary colour', () => {
    expect(resolveBrand({ colors: { primary: '#2f5d50' } }).header).toBe('#2f5d50');
  });

  it('gives the same random palette for the same seed, readable under white text', () => {
    const first = randomBrand('acme');

    expect(randomBrand('acme')).toEqual(first);
    expect(randomBrand('other')).not.toEqual(first);
    expect(contrastRatio(first.header, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(brandWarnings(first)).toEqual([]);
  });

  it('starts from a preset', () => {
    expect(resolveBrand({ mode: 'preset', preset: 'forest' })).toEqual(BRAND_PRESETS.forest);
  });

  it('rejects colours that are not hex and keeps a transparent footer', () => {
    expect(() => resolveBrand({ colors: { primary: 'navy' } })).toThrow('hex');
    expect(resolveBrand({ colors: { footer: 'transparent' } }).footer).toBe('transparent');
  });

  it('warns when white text would not read on the chrome', () => {
    expect(brandWarnings(resolveBrand({ colors: { primary: '#ffe08a', header: '#ffe08a' } }))).toHaveLength(2);
  });
});
