import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

/** A one-line text field. `mask` shows dots instead of the characters, for secrets. */
export function TextInput({
  label,
  initialValue = '',
  placeholder = '',
  mask = false,
  validate,
  invalidMessage,
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(initialValue);
  const [invalid, setInvalid] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }

    if (key.return) {
      if (validate && !validate(value)) {
        setInvalid(true);
        return;
      }

      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
      setInvalid(false);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((current) => current + input);
      setInvalid(false);
    }
  });

  return html`
    <${Box} flexDirection="column">
      <${Box}>
        <${Text} color=${COLORS.accent}>${label} </${Text}>
        <${Text}>${(mask ? '•'.repeat(value.length) : value) || html`<${Text} color=${COLORS.muted}>${placeholder}</${Text}>`}</${Text}>
        <${Text} color=${COLORS.accent}>▏</${Text}>
      </${Box}>
      ${invalid ? html`<${Text} color=${COLORS.error}>${invalidMessage}</${Text}>` : null}
    </${Box}>
  `;
}
