import { Box, Text, useInput } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

/** A passage of the documents that answers what the person asked, word for word, with where it comes from. */
export function Answer({ strings, answer, onBack }) {
  useInput((input, key) => {
    if (key.return || key.escape) {
      onBack();
    }
  });

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      <${Text} bold>${answer.heading}</${Text}>
      <${Text} color=${COLORS.muted}>${answer.source}</${Text}>
      <${Box} marginY=${1}><${Text}>${answer.text}</${Text}></${Box}>
      <${Text} color=${COLORS.muted}>${strings.answerHint}</${Text}>
    </${Box}>
  `;
}
