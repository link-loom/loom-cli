// Loomi, the weaver of Link Loom: a round, furry little creature drawn as pixel art. Every text cell holds two pixels
// (a half block in one colour over a background in the other), so the sprite keeps square pixels in any terminal. Pure data and functions: the Ink component lives in Mascot.js.

export const LOOMI_PALETTE = Object.freeze({
  F: '#56C4DC', // fur
  o: '#2B93B0', // the soft edge of the fur
  l: '#9BE0EE', // light on the fur
  h: '#C8F1F8', // belly
  W: '#FFFFFF', // eye glints
  P: '#1B2433', // eyes and mouth
  L: '#2B93B0', // feet and the leg that holds a tool
  T: '#8FD3F7', // a tear
  Y: '#F2C230', // hard hat
  y: '#C9961A', // hard hat in shadow, its brim
  w: '#FFE58A', // light on the hard hat
  g: '#A7B1BC', // steel of the tools
  G: '#6E7A86', // steel in shadow
  b: '#9A6534', // hammer handle
});

// The pixels that are the face: without colour they read as holes, so the face still shows.
const FACE = new Set(['W', 'P']);

// A round ball of fur with a cloud's edge (soft bumps, no spikes), big eyes far apart and a wide smile with fur all
// around it: the belly stays a row below, so nothing frames the mouth and it never reads as a beak. 20 pixels wide and
// 16 tall, centred on a canvas of 26 so the tools fit at its sides: 26 columns and 8 rows of text.
const pad = (row) => `...${row}...`;

const BODY = Object.freeze(
  [
    '.....oo.oooo.oo.....',
    '...ooFFoFFFFoFFoo...',
    '..oFFlFFFFFFFFFFFo..',
    '.oFFlFFFFFFFFFFFFFo.',
    'oFFFFFFFFFFFFFFFFFFo',
    'oFFFWPPFFFFFFWPPFFFo',
    'oFFFPPPFFFFFFPPPFFFo',
    '.oFFPPWFFFFFFPPWFFo.',
    'oFFFFFFPFFFFPFFFFFFo',
    'oFFFFFFFPPPPFFFFFFFo',
    'oFFFFFFFFFFFFFFFFFFo',
    '.oFFFFhhhhhhhhFFFFo.',
    '.oFFFFFhhhhhhFFFFFo.',
    '..oFFFFFFFFFFFFFFo..',
    '...ooFFoFFFFoFFoo...',
    '....LL..oooo..LL....',
  ].map(pad),
);

const withRows = (rows, changes) => rows.map((row, index) => changes[index] ?? row);

// A yellow hard hat bigger than the head: its dome as wide as the head, a ridge down the middle, and a brim that
// sticks out past the fur on both sides, just over the eyes.
const HARD_HAT = Object.freeze({
  0: '.......yYYYYyyYYYYy.......',
  1: '.....yYwwYYYyyYYYYYYy.....',
  2: '....yYwYYYYYyyYYYYYYYy....',
  3: '...yYYYYYYYYYYYYYYYYYYy...',
  4: '.yyyyyyyyyyyyyyyyyyyyyyyy.',
});

export const LOOMI_FRAMES = Object.freeze({
  // Eyes open, then a quick blink.
  idle: [
    { rows: BODY, ms: 2600 },
    {
      rows: withRows(BODY, {
        5: '...oFFFFFFFFFFFFFFFFFFo...',
        6: '...oFFFPPPFFFFFFPPPFFFo...',
        7: '....oFFFFFFFFFFFFFFFFo....',
      }),
      ms: 160,
    },
  ],
  // At work: a hard hat bigger than its head, a wrench in one hand and a hammer in the other that goes up and comes
  // down; the eyes follow the hammer.
  working: [
    {
      rows: withRows(BODY, {
        ...HARD_HAT,
        5: '...oFFFFWPPFFFFFFWPPFFo.gG',
        6: '...oFFFFPPPFFFFFFPPPFFo.gG',
        7: 'g.g.oFFFPPWFFFFFFPPWFo..b.',
        8: '.g.oFFFFFFPFFFFPFFFFFFo.b.',
        9: '.gLoFFFFFFFPPPPFFFFFFFoLb.',
      }),
      ms: 260,
    },
    {
      rows: withRows(BODY, {
        ...HARD_HAT,
        7: 'g.g.oFFPPWFFFFFFPPWFFo....',
        8: '.g.oFFFFFFPFFFFPFFFFFFo..g',
        9: '.gLoFFFFFFFPPPPFFFFFFFoLbg',
        10: '...oFFFFFFFFFFFFFFFFFFo..G',
      }),
      ms: 260,
    },
  ],
  // Happy: eyes closed in two little arches, a big smile, waving a hand.
  success: [
    {
      rows: withRows(BODY, {
        3: '....oFFlFFFFFFFFFFFFFo..L.',
        4: '...oFFFFFFFFFFFFFFFFFFoL..',
        5: '...oFFFFPFFFFFFFFPFFFFo...',
        6: '...oFFFPFPFFFFFFPFPFFFo...',
        7: '....oFFFFFFFFFFFFFFFFo....',
        8: '...oFFFFFPFFFFFFPFFFFFo...',
        9: '...oFFFFFFPPPPPPFFFFFFo...',
      }),
      ms: 0,
    },
  ],
  // Something went wrong: sad, droopy lids, a tear and a little frown.
  error: [
    {
      rows: withRows(BODY, {
        5: '...oFFFoooFFFFFFoooFFFo...',
        6: '...oFFFPPPFFFFFFPPPFFFo...',
        7: '....oFFPPWFFFFFFPPWFFo....',
        8: '...oFFFTFFFPPPPFFFFFFFo...',
        9: '...oFFFTFFPFFFFPFFFFFFo...',
      }),
      ms: 0,
    },
  ],
});

// How light a colour is (0 black, 1 white): the darker of a cell's two pixels is the glyph.
const lightness = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
};

/**
 * The text rows of a sprite: each cell is `{ text, color?, backgroundColor? }`. With `color: false` (NO_COLOR) the
 * cells are plain half and full blocks and the face is left empty, so the silhouette and its eyes still read.
 */
export const spriteRows = (rows, { color = true, palette = LOOMI_PALETTE } = {}) => {
  const pixel = (code) => {
    if (!code || code === '.') return null;
    if (!color && FACE.has(code)) return null;
    return color ? palette[code] : 'ink';
  };

  const lines = [];
  for (let top = 0; top < rows.length; top += 2) {
    const upper = rows[top];
    const lower = rows[top + 1] || '';
    const cells = [...upper].map((code, column) => {
      const above = pixel(code);
      const below = pixel(lower[column]);
      if (!above && !below) return { text: ' ' };
      if (!color) return { text: above && below ? '█' : above ? '▀' : '▄' };
      if (above && above === below) return { text: '█', color: above, backgroundColor: above };
      if (!above || !below) return above ? { text: '▀', color: above } : { text: '▄', color: below };
      // Many terminals draw block glyphs a little short of the cell, and what they leave uncovered shows the
      // background. A light glyph over a dark background leaves a bright seam (wrinkles under the eyes), so the glyph
      // is the darker pixel; and the strip left at the top shows the colour of the pixel above when it can.
      const overhead = top > 0 ? pixel(rows[top - 1][column]) : null;
      const darkOnTop = lightness(above) < lightness(below);
      if (darkOnTop && overhead !== above) return { text: '▀', color: above, backgroundColor: below };
      return { text: '▄', color: below, backgroundColor: above };
    });
    lines.push(cells);
  }

  return lines;
};
