import { mixColors, normalizeHex, shiftLightness } from '@link-loom/devkit';

/** The Mi Retail landing's accent family, exactly, for the default coral. */
const DEFAULT_ACCENT = Object.freeze({
  accent: '#f0655c',
  accentDeep: '#d94c43',
  accentSoft: '#f68d86',
  accentTint: '#fde5e3',
});

const accentFamily = (accent) =>
  accent === DEFAULT_ACCENT.accent
    ? DEFAULT_ACCENT
    : {
        accent,
        accentDeep: shiftLightness(accent, -0.08),
        accentSoft: mixColors(accent, '#ffffff', 0.75),
        accentTint: mixColors(accent, '#ffffff', 0.17),
      };

/** The brand block of _tokens.scss: brand anchors, the accent family and the call-to-action pill. */
export const landingPalette = ({ primaryColor, secondaryColor, accentColor, ctaColor }) => {
  const cta = normalizeHex(ctaColor);
  return {
    brand: normalizeHex(primaryColor),
    brandAlt: normalizeHex(secondaryColor),
    ...accentFamily(normalizeHex(accentColor)),
    cta,
    ctaDark: cta === '#131316' ? '#000000' : shiftLightness(cta, -0.08),
  };
};

const FONT_WEIGHTS = Object.freeze({ display: '300;400;600;700', body: '300;400;500', mono: '400;500;600' });

/** The Google Fonts stylesheet for the three families. */
export const fontsHref = (fonts) => {
  const families = [
    [fonts.display, FONT_WEIGHTS.display],
    [fonts.body, FONT_WEIGHTS.body],
    [fonts.mono, FONT_WEIGHTS.mono],
  ]
    .filter(([family], index, list) => list.findIndex(([other]) => other === family) === index)
    .map(([family, weights]) => `family=${family.trim().replace(/\s+/g, '+')}:wght@${weights}`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
};
