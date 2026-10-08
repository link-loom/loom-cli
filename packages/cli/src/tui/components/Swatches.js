import { Box, Text } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

const SWATCH = '    ';

/** The palette as truecolor blocks with their names, so the person sees the colours before anything is written. */
export function Swatches({ colors, labels }) {
  const entries = Object.entries(labels).filter(([key]) => colors[key] && colors[key] !== 'transparent');

  return html`
    <${Box} flexWrap="wrap">
      ${entries.map(
        ([key, label]) => html`
          <${Box} key=${key} marginRight=${2}>
            <${Text} backgroundColor=${colors[key]}>${SWATCH}</${Text}>
            <${Text} color=${COLORS.muted}> ${label} ${colors[key]}</${Text}>
          </${Box}>
        `,
      )}
    </${Box}>
  `;
}
