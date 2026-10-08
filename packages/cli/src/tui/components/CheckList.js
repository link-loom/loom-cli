import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

/**
 * A keyboard list of options to mark: ↑↓ move, space marks or unmarks, enter confirms what is marked. With
 * `fromText`, typing words ("copy the id and open in a new tab") and pressing enter marks the options they name,
 * for a last look before confirming.
 */
export function CheckList({ items, initial = [], fromText, onDone, onCancel }) {
  const [cursor, setCursor] = useState(0);
  const [marked, setMarked] = useState(() => new Set(initial.map(String)));
  const [phrase, setPhrase] = useState('');

  useInput((input, key) => {
    if (key.escape && phrase) {
      setPhrase('');
      return;
    }

    if (key.escape) {
      onCancel?.();
      return;
    }

    if (phrase && key.return) {
      setMarked(new Set(fromText(phrase, items).map((item) => item.key)));
      setPhrase('');
      return;
    }

    if (phrase && (key.backspace || key.delete)) {
      setPhrase(phrase.slice(0, -1));
      return;
    }

    if (fromText && input && !key.ctrl && !key.meta && (phrase || /\p{L}/u.test(input))) {
      setPhrase(phrase + input);
      return;
    }

    if (key.upArrow) {
      setCursor(Math.max(cursor - 1, 0));
      return;
    }

    if (key.downArrow) {
      setCursor(Math.min(cursor + 1, items.length - 1));
      return;
    }

    if (input === ' ') {
      const key = items[cursor].key;
      setMarked((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      return;
    }

    if (key.return) {
      onDone(items.filter((item) => marked.has(item.key)).map((item) => item.value));
    }
  });

  return html`
    <${Box} flexDirection="column">
      ${phrase ? html`<${Text} color=${COLORS.muted}>› ${phrase}</${Text}>` : null}
      ${items.map(
        (item, index) => html`
          <${Text} key=${item.key} color=${index === cursor ? COLORS.accent : undefined}>
            ${index === cursor ? '›' : ' '} ${marked.has(item.key) ? '[x]' : '[ ]'} ${item.label}
          </${Text}>
        `,
      )}
    </${Box}>
  `;
}
