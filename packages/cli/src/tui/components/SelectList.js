import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

const matches = (item, filter) =>
  !filter || `${item.label} ${item.summary || ''}`.toLowerCase().includes(filter.toLowerCase());

const LABEL_WIDTH = 24;

const firstEnabled = (items) =>
  Math.max(
    items.findIndex((item) => !item.disabled),
    0,
  );

/**
 * A keyboard list that filters as you type. Disabled items stay visible with their hint but cannot be chosen.
 * `suggest(filter)` may answer (or resolve to) one more item for what was typed, the local AI's proposal, shown
 * first; it is chosen when no row of the list matches.
 */
export function SelectList({ items, onSelect, onCancel, filterable = true, suggest }) {
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(() => firstEnabled(items));
  const [suggestion, setSuggestion] = useState(null);
  const listed = useMemo(() => items.filter((item) => matches(item, filter)), [items, filter]);
  const visible = useMemo(() => [...(suggestion ? [suggestion] : []), ...listed], [listed, suggestion]);
  const active = Math.min(cursor, Math.max(visible.length - 1, 0));

  // The screens pass new `items` and `suggest` on every render: the effect reads the latest through a ref and runs
  // only when the filter changes.
  const latest = useRef({ items, suggest });
  latest.current = { items, suggest };

  useEffect(() => {
    let current = true;
    if (!latest.current.suggest || filter.trim().length <= 3) {
      setSuggestion(null);
      return undefined;
    }

    Promise.resolve(latest.current.suggest(filter)).then((item) => {
      if (!current) return;
      const matching = latest.current.items.filter((entry) => matches(entry, filter));
      setSuggestion(item || null);
      setCursor(matching.length ? firstEnabled(matching) + (item ? 1 : 0) : 0);
    });
    return () => {
      current = false;
    };
  }, [filter]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.upArrow) {
      setCursor(Math.max(active - 1, 0));
      return;
    }

    if (key.downArrow) {
      setCursor(Math.min(active + 1, visible.length - 1));
      return;
    }

    if (key.return) {
      const item = visible[active];
      if (item && !item.disabled) {
        onSelect(item);
      }
      return;
    }

    if (!filterable) {
      return;
    }

    if (key.backspace || key.delete) {
      setFilter((current) => current.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const nextFilter = filter + input;
      setFilter(nextFilter);
      setCursor(firstEnabled(items.filter((item) => matches(item, nextFilter))));
    }
  });

  return html`
    <${Box} flexDirection="column">
      ${filter ? html`<${Text} color=${COLORS.muted}>› ${filter}</${Text}>` : null}
      ${visible.map((item, index) => {
        const selected = index === active;
        const color = item.disabled ? COLORS.muted : selected ? COLORS.accent : undefined;
        const detail = [item.hint, item.summary].filter(Boolean).join(' · ');
        return html`
          <${Box} key=${item.key}>
            <${Box} width=${LABEL_WIDTH} flexShrink=${0}>
              <${Text} color=${color} wrap="truncate-end">${selected ? '▸ ' : '  '}${item.label}</${Text}>
            </${Box}>
            <${Text} color=${COLORS.muted} wrap="truncate-end">${detail}</${Text}>
          </${Box}>
        `;
      })}
    </${Box}>
  `;
}
