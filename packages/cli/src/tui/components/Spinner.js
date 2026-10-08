import { useEffect, useState } from 'react';
import { Text } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

const TRACK = '═─═─═─';
// A shuttle crossing the threads and coming back.
const POSITIONS = [...Array(TRACK.length).keys(), ...[...Array(TRACK.length).keys()].reverse().slice(1, -1)];

export const spinnerFrame = (index) => {
  const position = POSITIONS[index % POSITIONS.length];
  return `${TRACK.slice(0, position)}▸${TRACK.slice(position + 1)}`;
};

export function Spinner({ animate = true }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!animate) {
      return undefined;
    }

    const timer = setInterval(() => setIndex((current) => current + 1), 90);
    return () => clearInterval(timer);
  }, [animate]);

  return html`<${Text} color=${COLORS.accent}>${spinnerFrame(index)}</${Text}>`;
}
