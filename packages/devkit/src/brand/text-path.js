import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import opentypeModule from 'opentype.js';

const opentype = opentypeModule.parse ? opentypeModule : opentypeModule.default;

const FONT_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));

// Inter ships per script subset: latin first, then latin-ext for the letters latin lacks.
const FONT_FILES = Object.freeze({
  400: ['inter-latin-400-normal.woff', 'inter-latin-ext-400-normal.woff'],
  600: ['inter-latin-600-normal.woff', 'inter-latin-ext-600-normal.woff'],
});

const cache = new Map();

const loadFont = (file) => {
  const buffer = fs.readFileSync(`${FONT_DIR}${file}`);
  return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
};

const fontsFor = (weight) => {
  if (!FONT_FILES[weight]) {
    throw new Error(`Inter weight ${weight} is not bundled; use ${Object.keys(FONT_FILES).join(' or ')}`);
  }

  if (!cache.has(weight)) {
    cache.set(weight, FONT_FILES[weight].map(loadFont));
  }

  return cache.get(weight);
};

const glyphFor = (fonts, char) => {
  const font = fonts.find((candidate) => candidate.charToGlyphIndex(char) > 0) || fonts[0];
  return { font, glyph: font.charToGlyph(char) };
};

/**
 * Text as SVG path data in Inter, so a logo or an OG image renders the same everywhere: an SVG shown through <img>
 * cannot load web fonts. Glyphs are placed one by one (no shaping), which is all a name or a tagline needs.
 */
export const textToPath = (text, { size, weight = 600, x = 0, y = 0, letterSpacing = 0 }) => {
  const fonts = fontsFor(weight);
  let cursor = x;
  const parts = [];

  for (const char of String(text)) {
    const { font, glyph } = glyphFor(fonts, char);
    parts.push(glyph.getPath(cursor, y, size).toPathData(2));
    cursor += (glyph.advanceWidth / font.unitsPerEm) * size + letterSpacing;
  }

  return { d: parts.filter(Boolean).join(' '), width: cursor - x - letterSpacing };
};

/** Width of `text` at `size`, without building the path. */
export const measureText = (text, { size, weight = 600, letterSpacing = 0 }) => {
  const fonts = fontsFor(weight);
  const chars = [...String(text)];
  const advance = chars.reduce((total, char) => {
    const { font, glyph } = glyphFor(fonts, char);
    return total + (glyph.advanceWidth / font.unitsPerEm) * size;
  }, 0);

  return advance + letterSpacing * Math.max(0, chars.length - 1);
};
