import { contrastRatio, hslToHex, mixColors, normalizeHex, shiftLightness } from './color.js';

export const BRAND_COLOR_KEYS = Object.freeze(['primary', 'header', 'logoArea', 'background', 'footer']);
export const TRANSPARENT = 'transparent';

// The logo area sits a shade under the header: Mi Retail's #3c4876 → #2f3a5f is seven points of lightness.
export const LOGO_AREA_SHIFT = -0.07;
export const MIN_TEXT_CONTRAST = 4.5;

/** Mi Retail's palette: what an app gets when nobody chooses. */
export const DEFAULT_BRAND = Object.freeze({
  primary: '#3c4876',
  header: '#3c4876',
  logoArea: '#2f3a5f',
  background: '#eff3f9',
  footer: TRANSPARENT,
});

const presetFrom = (primary) =>
  Object.freeze({
    primary,
    header: primary,
    logoArea: shiftLightness(primary, LOGO_AREA_SHIFT),
    background: mixColors(primary, '#f4f6f9', 0.05),
    footer: TRANSPARENT,
  });

export const BRAND_PRESETS = Object.freeze({
  indigo: DEFAULT_BRAND,
  plum: presetFrom('#3a2e4f'),
  forest: presetFrom('#2f5d50'),
  ocean: presetFrom('#1f4e79'),
  graphite: presetFrom('#2f343b'),
  clay: presetFrom('#6b4a3a'),
});

export const BRAND_MODES = Object.freeze({ default: 'default', preset: 'preset', random: 'random' });

/** Mulberry32: a small seeded generator, so `--seed` gives the same palette on every machine. */
const seededRandom = (seed) => {
  let state = [...String(seed)].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const between = (random, low, high) => low + random() * (high - low);

/** Darkens until white text on `color` passes WCAG AA. */
const darkenForWhiteText = (color) => {
  let candidate = color;
  for (let step = 0; step < 20 && contrastRatio(candidate, '#ffffff') < MIN_TEXT_CONTRAST; step += 1) {
    candidate = shiftLightness(candidate, -0.02);
  }

  return candidate;
};

/** A sober, harmonious palette from a seed: one muted hue for the chrome and a near-white ground of the same hue. */
export const randomBrand = (seed = Date.now()) => {
  const random = seededRandom(seed);
  const hue = between(random, 0, 360);
  const primary = darkenForWhiteText(hslToHex([hue, between(random, 0.22, 0.45), between(random, 0.26, 0.36)]));
  return {
    primary,
    header: primary,
    logoArea: shiftLightness(primary, LOGO_AREA_SHIFT),
    background: hslToHex([hue, between(random, 0.18, 0.3), 0.96]),
    footer: TRANSPARENT,
  };
};

const normalizeColor = (key, value) => {
  if (key === 'footer' && value === TRANSPARENT) {
    return TRANSPARENT;
  }

  const hex = normalizeHex(value);
  if (!hex) {
    throw new Error(`The ${key} colour must be a hex value like #3c4876, got: ${value}`);
  }

  return hex;
};

/**
 * The brand palette from the person's choices: a base (default, preset or random, or `from` an existing palette)
 * and any colour they set by hand.
 * When the header changes and the logo area is not given, the logo area follows the header a shade darker.
 */
export const resolveBrand = ({ mode = BRAND_MODES.default, preset, seed, colors = {}, from } = {}) => {
  const base =
    from ||
    {
      [BRAND_MODES.default]: () => DEFAULT_BRAND,
      [BRAND_MODES.preset]: () => BRAND_PRESETS[preset] || DEFAULT_BRAND,
      [BRAND_MODES.random]: () => randomBrand(seed),
    }[mode]?.();

  if (!base) {
    throw new Error(`Unknown brand mode: ${mode}`);
  }

  const chosen = Object.fromEntries(
    BRAND_COLOR_KEYS.filter((key) => colors[key]).map((key) => [key, normalizeColor(key, colors[key])]),
  );

  const header = chosen.header || (chosen.primary && !colors.header ? chosen.primary : base.header);
  const logoArea =
    chosen.logoArea || (header === base.header ? base.logoArea : shiftLightness(header, LOGO_AREA_SHIFT));

  return { ...base, ...chosen, header, logoArea };
};

/** Contrast problems a person should hear about before the colours ship. */
export const brandWarnings = (brand) =>
  ['primary', 'header']
    .filter((key) => contrastRatio(brand[key], '#ffffff') < MIN_TEXT_CONTRAST)
    .map((key) => `White text on the ${key} colour (${brand[key]}) is below WCAG AA contrast (${MIN_TEXT_CONTRAST}:1)`);
