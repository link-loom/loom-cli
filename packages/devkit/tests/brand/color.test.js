import {
  contrastRatio,
  hexToHsl,
  hexToRgb,
  hslToHex,
  mixColors,
  normalizeHex,
  readableOn,
  shiftLightness,
} from '../../src/brand/color.js';

describe('brand colours', () => {
  it('normalizes short and upper-case hex and rejects anything else', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('3C4876')).toBe('#3c4876');
    expect(normalizeHex('blue')).toBeNull();
  });

  it('round-trips through HSL', () => {
    for (const hex of ['#3c4876', '#2f3a5f', '#eff3f9', '#ffffff', '#000000', '#e5484d']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it("darkens Mi Retail's header to within a step of its hand-picked logo area (#2f3a5f)", () => {
    const derived = hexToRgb(shiftLightness('#3c4876', -0.07));

    hexToRgb('#2f3a5f').forEach((channel, index) => expect(Math.abs(derived[index] - channel)).toBeLessThanOrEqual(2));
  });

  it('mixes like CSS color-mix in srgb', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('measures WCAG contrast and picks the readable ink', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(readableOn('#3c4876')).toBe('#ffffff');
    expect(readableOn('#eff3f9')).toBe('#1b2233');
  });
});
