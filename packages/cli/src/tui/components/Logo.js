import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { html } from '../html.js';
import { COLORS, FRAME_MS } from '../theme.js';

const GLYPHS = Object.freeze({
  L: ['█   ', '█   ', '█▄▄▄'],
  I: ['█', '█', '█'],
  N: ['█▄  █', '█ ▀▄█', '█   █'],
  K: ['█  ▄▀', '█▀▄  ', '█  ▀▄'],
  O: ['▄▀▀▄', '█  █', '▀▄▄▀'],
  M: ['█▄ ▄█', '█ ▀ █', '█   █'],
});

const word = (letters) => [0, 1, 2].map((row) => letters.map((letter) => GLYPHS[letter][row]).join(' '));

const LINK = word(['L', 'I', 'N', 'K']);
const LOOM = word(['L', 'O', 'O', 'M']);
export const LOGO_ROWS = [0, 1, 2].map((row) => `${LINK[row]}   ${LOOM[row]}`);

const WIDTH = LOGO_ROWS[0].length;
const WARP_FRAMES = 4;
const WEFT_FRAMES = 12;
export const LOGO_FRAMES = WARP_FRAMES + WEFT_FRAMES;

/**
 * One frame of the woven wordmark: first the warp threads appear where the letters will be, then the shuttle
 * crosses from left to right and every column it passes becomes the letter.
 */
export const logoFrame = (frame) => {
  if (frame >= LOGO_FRAMES) {
    return LOGO_ROWS.map((row) => [{ text: row, kind: 'glyph' }]);
  }

  const woven = frame < WARP_FRAMES ? -1 : Math.floor(((frame - WARP_FRAMES + 1) / WEFT_FRAMES) * WIDTH);
  return LOGO_ROWS.map((row) =>
    [...row].map((character, column) => {
      if (column < woven) {
        return { text: character, kind: 'glyph' };
      }

      if (column === woven) {
        return { text: '▸', kind: 'shuttle' };
      }

      return { text: character === ' ' ? ' ' : '│', kind: 'thread' };
    }),
  );
};

const COLOR_BY_KIND = Object.freeze({ glyph: COLORS.accent, shuttle: 'white', thread: COLORS.thread });

export function Logo({ animate = true, tagline }) {
  const [frame, setFrame] = useState(animate ? 0 : LOGO_FRAMES);

  useEffect(() => {
    if (frame >= LOGO_FRAMES) {
      return undefined;
    }

    const timer = setTimeout(() => setFrame((current) => current + 1), FRAME_MS);
    return () => clearTimeout(timer);
  }, [frame]);

  const rows = logoFrame(frame);
  return html`
    <${Box} flexDirection="column" marginBottom=${1}>
      ${rows.map(
        (cells, rowIndex) => html`
          <${Text} key=${rowIndex}>
            ${cells.map((cell, cellIndex) => html`<${Text} key=${cellIndex} color=${COLOR_BY_KIND[cell.kind]}>${cell.text}</${Text}>`)}
          </${Text}>
        `,
      )}
      ${tagline ? html`<${Text} color=${COLORS.muted}>${tagline}</${Text}>` : null}
    </${Box}>
  `;
}
