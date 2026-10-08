import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { html } from '../html.js';
import { LOOMI_FRAMES, spriteRows } from './loomi.sprite.js';

export const MASCOT_STATES = Object.freeze({ idle: 'idle', working: 'working', success: 'success', error: 'error' });

// NO_COLOR keeps the silhouette: plain blocks, the face left empty.
const hasColor = (env = process.env) => !env.NO_COLOR && env.FORCE_COLOR !== '0';

/** Loomi alone: the frames of a state, each held for its own time (a blink is quick, the open eyes are not). */
export function Loomi({ state = MASCOT_STATES.idle, animate = true }) {
  const frames = LOOMI_FRAMES[state] || LOOMI_FRAMES.idle;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
  }, [state]);

  useEffect(() => {
    if (!animate || frames.length < 2) {
      return undefined;
    }

    const timer = setTimeout(() => setFrame((current) => (current + 1) % frames.length), frames[frame].ms || 400);
    return () => clearTimeout(timer);
  }, [state, animate, frame]);

  const rows = spriteRows(frames[frame % frames.length].rows, { color: hasColor() });
  return html`
    <${Box} flexDirection="column">
      ${rows.map(
        (cells, rowIndex) => html`
          <${Text} key=${rowIndex}>
            ${cells.map(
              (cell, cellIndex) =>
                html`<${Text} key=${cellIndex} color=${cell.color} backgroundColor=${cell.backgroundColor}>${cell.text}</${Text}>`,
            )}
          </${Text}>
        `,
      )}
    </${Box}>
  `;
}

/** Loomi with what it has to say beside it. */
export function Mascot({ state = MASCOT_STATES.idle, message, animate = true }) {
  return html`
    <${Box} flexDirection="row" alignItems="center" marginBottom=${1}>
      <${Box} marginRight=${2}><${Loomi} state=${state} animate=${animate} /></${Box}>
      <${Text}>${message}</${Text}>
    </${Box}>
  `;
}
