import { useMemo, useState } from 'react';
import { Box, Text } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { localize } from '../i18n.js';
import { CheckList } from '../components/CheckList.js';
import { optionsIn } from '../../ai/extract.js';
import { SelectList } from '../components/SelectList.js';
import { TextInput } from '../components/TextInput.js';

const byOrder = ([, left], [, right]) => (left['x-order'] ?? 99) - (right['x-order'] ?? 99);

/** Every field the schema asks people (`x-prompt`), in its order. */
const promptedFields = (schema) =>
  Object.entries(schema.properties || {})
    .filter(([, property]) => property['x-prompt'])
    .sort(byOrder)
    .map(([name, property]) => ({ name, property }));

const withDefaults = (schema, values) => ({
  ...Object.fromEntries(Object.entries(schema.properties || {}).map(([name, property]) => [name, property.default])),
  ...values,
});

/** `x-when: { field: value }`: a field is asked only while every listed field has that value. */
const applies = (field, values) =>
  Object.entries(field.property['x-when'] || {}).every(([name, expected]) => values[name] === expected);

/** The fields still to ask, given what is known: prompted, not answered yet and applicable now. */
export const pendingFields = (schema, known) => {
  const values = withDefaults(schema, known);
  return promptedFields(schema).filter((field) => known[field.name] === undefined && applies(field, values));
};

const defaultFirst = (options, defaultValue) => [
  ...options.filter((option) => option.key === String(defaultValue)),
  ...options.filter((option) => option.key !== String(defaultValue)),
];

const choicesFor = (property, strings, locale) => {
  if (property.type === 'boolean') {
    return defaultFirst(
      [
        { key: 'true', label: strings.yes, value: true },
        { key: 'false', label: strings.no, value: false },
      ],
      property.default,
    );
  }

  const labels = localize(property['x-enum-labels'], locale) || {};
  return defaultFirst(
    property.enum.map((option) => ({ key: String(option), label: labels[option] || String(option), value: option })),
    property.default,
  );
};

const isChoice = (property) => property.type === 'boolean' || Array.isArray(property.enum);

// A list whose items come from a fixed set (row actions): several can be marked at once.
const isMultiChoice = (property) => property.type === 'array' && Array.isArray(property.items?.enum);

const multiChoicesFor = (property, locale) => {
  const labels = localize(property['x-enum-labels'], locale) || {};
  return property.items.enum.map((option) => ({
    key: String(option),
    label: labels[option] || String(option),
    value: option,
  }));
};

/**
 * Asks the prompted fields of a generator's schema one by one: a list for choices (the default first), a text field
 * otherwise, masked for secrets. Conditional fields (`x-when`) appear only when they apply; esc goes back a step.
 */
export function Wizard({ schema, initialValues, strings, locale, onDone, onCancel }) {
  const candidates = useMemo(
    () => promptedFields(schema).filter((field) => initialValues[field.name] === undefined),
    [schema],
  );
  const [values, setValues] = useState(initialValues);
  const [answered, setAnswered] = useState([]);

  const remainingFor = (current, done) =>
    candidates.filter((field) => !done.includes(field.name) && applies(field, withDefaults(schema, current)));
  const remaining = remainingFor(values, answered);
  const field = remaining[0];

  if (!field) {
    return null;
  }

  const answer = (value) => {
    const next = { ...values, [field.name]: value };
    const done = [...answered, field.name];
    if (!remainingFor(next, done).length) {
      // A field whose condition stopped holding after going back is not sent.
      const kept = Object.fromEntries(
        Object.entries(next).filter(([name]) => {
          const asked = candidates.find((candidate) => candidate.name === name);
          return !asked || applies(asked, withDefaults(schema, next));
        }),
      );
      onDone(kept);
      return;
    }

    setValues(next);
    setAnswered(done);
  };

  const back = () => {
    if (!answered.length) {
      onCancel();
      return;
    }

    setAnswered(answered.slice(0, -1));
  };

  const { property } = field;
  const label = localize(property['x-prompt'], locale);
  const pattern = property.pattern ? new RegExp(property.pattern) : null;
  const required = (schema.required || []).includes(field.name) || property.minLength > 0;
  const validate = (text) => {
    if (!text) {
      return !required;
    }

    if (property.type === 'integer') {
      return /^\d+$/.test(text) && (property.minimum === undefined || Number(text) >= property.minimum);
    }

    return !pattern || pattern.test(text);
  };
  const submitText = (text) => answer(property.type === 'integer' ? Number(text) : text);
  const initialText = values[field.name] ?? property.default ?? '';

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      <${Text} color=${COLORS.muted}>${answered.length + 1} / ${answered.length + remaining.length}</${Text}>
      ${
        isMultiChoice(property)
          ? html`
            <${Box} flexDirection="column">
              <${Text} color=${COLORS.accent}>${label}</${Text}>
              <${CheckList}
                key=${field.name}
                items=${multiChoicesFor(property, locale)}
                initial=${values[field.name] ?? property.default ?? []}
                fromText=${(text, options) => optionsIn(text, options, field.name)}
                onDone=${answer}
                onCancel=${back}
              />
            </${Box}>
          `
          : isChoice(property)
            ? html`
            <${Box} flexDirection="column">
              <${Text} color=${COLORS.accent}>${label}</${Text}>
              <${SelectList}
                key=${field.name}
                filterable=${false}
                items=${choicesFor(property, strings, locale)}
                onSelect=${(item) => answer(item.value)}
                onCancel=${back}
              />
            </${Box}>
          `
            : html`
                <${TextInput}
                  key=${field.name}
                  label=${label}
                  initialValue=${property['x-secret'] ? '' : String(initialText)}
                  mask=${Boolean(property['x-secret'])}
                  validate=${validate}
                  invalidMessage=${strings.invalidValue}
                  onSubmit=${submitText}
                  onCancel=${back}
                />
                ${property['x-secret'] ? html`<${Text} color=${COLORS.muted}>${strings.secretHint}</${Text}>` : null}
              `
      }
      <${Box} marginTop=${1}><${Text} color=${COLORS.muted}>${isMultiChoice(property) ? strings.checkHint : strings.fieldHint}</${Text}></${Box}>
    </${Box}>
  `;
}
