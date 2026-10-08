const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isHexColor = (value) => typeof value === 'string' && HEX_PATTERN.test(value);

/** `abc`, `#abc` or `#AABBCC` → `#aabbcc`. Anything else returns null. */
export const normalizeHex = (value) => {
  if (!isHexColor(value)) {
    return null;
  }

  const digits = value.replace('#', '').toLowerCase();
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  return `#${full}`;
};

export const hexToRgb = (hex) => {
  const value = normalizeHex(hex);
  if (!value) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
};

const clampChannel = (channel) => Math.min(255, Math.max(0, Math.round(channel)));

export const rgbToHex = (rgb) =>
  `#${rgb.map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;

export const rgbToHsl = ([red, green, blue]) => {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) {
    return [0, 0, lightness];
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  return [hueSector({ r, g, b, max, delta }) * 60, saturation, lightness];
};

const hueSector = ({ r, g, b, max, delta }) => {
  if (max === r) {
    return (g - b) / delta + (g < b ? 6 : 0);
  }

  if (max === g) {
    return (b - r) / delta + 2;
  }

  return (r - g) / delta + 4;
};

const hueToChannel = (p, q, t) => {
  const wrapped = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (wrapped < 1 / 6) {
    return p + (q - p) * 6 * wrapped;
  }

  if (wrapped < 1 / 2) {
    return q;
  }

  if (wrapped < 2 / 3) {
    return p + (q - p) * (2 / 3 - wrapped) * 6;
  }

  return p;
};

export const hslToRgb = ([hue, saturation, lightness]) => {
  if (saturation === 0) {
    return [lightness, lightness, lightness].map((channel) => channel * 255);
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const h = (((hue % 360) + 360) % 360) / 360;
  return [h + 1 / 3, h, h - 1 / 3].map((t) => hueToChannel(p, q, t) * 255);
};

export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));
export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));

const clampUnit = (value) => Math.min(1, Math.max(0, value));

/** Moves the HSL lightness by `amount` (0–1): negative darkens, positive lightens. */
export const shiftLightness = (hex, amount) => {
  const [hue, saturation, lightness] = hexToHsl(hex);
  return hslToHex([hue, saturation, clampUnit(lightness + amount)]);
};

/** `weight` of `color` over `base`, like CSS `color-mix(in srgb, color weight, base)`. */
export const mixColors = (color, base, weight) => {
  const top = hexToRgb(color);
  const bottom = hexToRgb(base);
  return rgbToHex(top.map((channel, index) => channel * weight + bottom[index] * (1 - weight)));
};

const linearChannel = (channel) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(linearChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio, from 1 to 21. */
export const contrastRatio = (first, second) => {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

/** White or the given dark ink, whichever reads better on `background`. */
export const readableOn = (background, dark = '#1b2233', light = '#ffffff') =>
  contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
