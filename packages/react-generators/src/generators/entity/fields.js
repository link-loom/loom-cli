import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { camelCase, inlineOf, sentenceCase } from './naming.js';

export const FIELD_TYPES = Object.freeze([
  'text',
  'longtext',
  'number',
  'date',
  'boolean',
  'email',
  'url',
  'options',
  'secret',
]);

export const FIELD_FLAGS = Object.freeze(['required', 'readonly', 'list']);

export const CUSTOM_ACTION_KINDS = Object.freeze(['call', 'replace', 'copy']);

const FIELD_NAME = /^[a-z][a-z0-9_]*$/;
const ACTION_ID = /^[a-z][a-z0-9-]*$/;
const OPTION_VALUE = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_DEFAULT_COLUMNS = 3;
const NOT_A_COLUMN = new Set(['longtext', 'secret', 'boolean']);

const invalid = (field, message) =>
  new LoomError(ERROR_CODES.validation, `Invalid ${field}: ${message}`, {
    missing: [],
    problems: [{ field, message }],
  });

/** `key=value` entries (a label list, the create defaults) as an object; the value may hold `=`. */
export const pairsOf = (entries = [], field) =>
  Object.fromEntries(
    entries.map((entry) => {
      const separator = entry.indexOf('=');
      if (separator < 1) {
        throw invalid(field, `"${entry}" is not key=value`);
      }

      return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
    }),
  );

const parseField = (spec) => {
  const [head, ...flags] = spec.split(':').slice(1);
  const name = spec.split(':')[0];
  const [type, argument] = String(head || 'text').split('=');
  if (!FIELD_NAME.test(name)) {
    throw invalid('fields', `"${name}" must be snake_case, starting with a letter`);
  }

  if (!FIELD_TYPES.includes(type)) {
    throw invalid('fields', `"${spec}": the type must be one of ${FIELD_TYPES.join(', ')}`);
  }

  const unknownFlag = flags.find((flag) => !FIELD_FLAGS.includes(flag));
  if (unknownFlag) {
    throw invalid('fields', `"${spec}": the flag "${unknownFlag}" is not one of ${FIELD_FLAGS.join(', ')}`);
  }

  const options =
    type === 'options'
      ? String(argument || '')
          .split('|')
          .filter(Boolean)
      : [];
  if (type === 'options' && (!options.length || !options.every((value) => OPTION_VALUE.test(value)))) {
    throw invalid('fields', `"${spec}": list the values as options=a|b|c (lowercase, digits, - or _)`);
  }

  return {
    name,
    type,
    options,
    required: flags.includes('required'),
    // A secret is made by the server: it is shown and copied, never typed.
    readonly: type === 'secret' || flags.includes('readonly'),
    listed: flags.includes('list'),
  };
};

const labelFor = (labels, name, fallback) => labels[name] || fallback;

const same = (value) => ({ record: value, value, payload: value });

// A value of each type for the generated tests, as source text: how the backend has it, how the form holds it and
// how it goes back.
const SAMPLES = Object.freeze({
  text: (name) => same(JSON.stringify(`Sample ${name.replace(/_/g, ' ')}`)),
  longtext: (name) => same(JSON.stringify(`Notes about the ${name.replace(/_/g, ' ')}`)),
  email: () => same('"person@example.com"'),
  url: () => same('"https://example.com"'),
  number: () => ({ record: '12', value: '"12"', payload: '12' }),
  date: () => same('"2026-01-31"'),
  boolean: () => same('true'),
  options: (name, options) => same(JSON.stringify(options[0])),
  secret: () => ({ record: '"key-0123456789abcdef"', value: null, payload: null }),
});

const TEXT_SOURCES = (name) => ({ initial: `record?.${name} ?? ""`, payload: `values.${name}.trim()` });

// How each type reads into the record's values and goes back out in the payload, as source text.
const SOURCES = Object.freeze({
  text: TEXT_SOURCES,
  longtext: TEXT_SOURCES,
  email: TEXT_SOURCES,
  url: TEXT_SOURCES,
  number: (name) => ({
    initial: `String(record?.${name} ?? "")`,
    payload: `values.${name} === "" ? null : Number(values.${name})`,
  }),
  date: (name) => ({ initial: `String(record?.${name} ?? "").slice(0, 10)`, payload: `values.${name} || null` }),
  boolean: (name) => ({ initial: `Boolean(record?.${name})`, payload: `values.${name}` }),
  options: (name) => ({ initial: `record?.${name} ?? ""`, payload: `values.${name} || null` }),
  secret: () => ({ initial: null, payload: null }),
});

/**
 * The fields of an entity from `name:type[=values][:flag…]` specs, with their labels. The first one is the record's
 * title: a text field, shown big in the header and as the first column. Columns are the fields flagged `list`, or
 * the first few that read well in a row.
 */
export const parseFields = ({ specs, labelsEn = {}, labelsEs = {} }) => {
  const fields = specs.map(parseField);
  const names = fields.map((field) => field.name);
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated) {
    throw invalid('fields', `"${repeated}" is listed twice`);
  }

  if (fields[0].type !== 'text' || fields[0].readonly) {
    throw invalid('fields', `the first field ("${fields[0].name}") is the record's title and must be an editable text`);
  }

  const flagged = fields.some((field) => field.listed);
  const defaultColumns = new Set(
    fields
      .slice(1)
      .filter((field) => !NOT_A_COLUMN.has(field.type))
      .slice(0, MAX_DEFAULT_COLUMNS - 1)
      .map((field) => field.name),
  );

  return fields.map((field, index) => {
    const labelEn = labelFor(labelsEn, field.name, sentenceCase(field.name));
    const optionLabel = (labels, value, fallback) => labels[`${field.name}.${value}`] || fallback;
    return {
      ...field,
      ...SOURCES[field.type](field.name),
      sample: SAMPLES[field.type](field.name, field.options),
      key: camelCase(field.name),
      isTitle: index === 0,
      inList: index === 0 || (flagged ? field.listed : defaultColumns.has(field.name)),
      labelEn,
      labelEs: labelFor(labelsEs, field.name, labelEn),
      translated: Boolean(labelsEs[field.name]),
      optionLabels: {
        en: Object.fromEntries(
          field.options.map((value) => [value, optionLabel(labelsEn, value, sentenceCase(value))]),
        ),
        es: Object.fromEntries(
          field.options.map((value) => [
            value,
            optionLabel(labelsEs, value, optionLabel(labelsEn, value, sentenceCase(value))),
          ]),
        ),
      },
    };
  });
};

/**
 * The entity's own actions from `id:kind[:field]` specs: `call` posts `{ id }` to `<endpoint>/<id>`, `replace`
 * creates a new record with the same values and deletes this one (a rotation), `copy:<field>` copies a field.
 * Every secret field adds its own `copy-<field>` action.
 */
export const parseCustomActions = ({ specs = [], fields, labelsEn = {}, labelsEs = {} }) => {
  const fromSpecs = specs.map((spec) => {
    const [id, kind = 'call', field] = spec.split(':');
    if (!ACTION_ID.test(id)) {
      throw invalid('customActions', `"${id}" must be kebab-case`);
    }

    if (!CUSTOM_ACTION_KINDS.includes(kind)) {
      throw invalid('customActions', `"${spec}": the kind must be one of ${CUSTOM_ACTION_KINDS.join(', ')}`);
    }

    if (kind === 'copy' && !fields.some((candidate) => candidate.name === field)) {
      throw invalid('customActions', `"${spec}": copy needs the name of a field, as ${id}:copy:<field>`);
    }

    return { id, kind, field };
  });

  const secretCopies = fields
    .filter((field) => field.type === 'secret')
    .map((field) => ({ id: `copy-${field.name.replace(/_/g, '-')}`, kind: 'copy', field: field.name }))
    .filter((action) => !fromSpecs.some((candidate) => candidate.id === action.id));

  return [...secretCopies, ...fromSpecs].map((action) => {
    const field = fields.find((candidate) => candidate.name === action.field);
    const fallbackEn = action.kind === 'copy' ? `Copy ${inlineOf(field.labelEn)}` : sentenceCase(action.id);
    const fallbackEs = action.kind === 'copy' ? `Copiar ${inlineOf(field.labelEs)}` : fallbackEn;
    return {
      ...action,
      key: camelCase(action.id),
      labelEn: labelsEn[action.id] || fallbackEn,
      labelEs: labelsEs[action.id] || fallbackEs,
      translated: Boolean(labelsEs[action.id]) || (action.kind === 'copy' && field.translated),
    };
  });
};
