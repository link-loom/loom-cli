import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

import { ERROR_CODES, LoomError } from '../errors.js';

// Both packages are CommonJS; under ESM their constructor can arrive as the module or as its `default`.
const Ajv2020 = Ajv2020Module.default || Ajv2020Module;
const addFormats = addFormatsModule.default || addFormatsModule;

const ajv = new Ajv2020({ allErrors: true, useDefaults: true, coerceTypes: true });
addFormats(ajv);
ajv.addKeyword({ keyword: 'x-prompt', schemaType: ['string', 'object'] });
ajv.addKeyword({ keyword: 'x-order', schemaType: 'number' });
ajv.addKeyword({ keyword: 'x-secret', schemaType: 'boolean' });
ajv.addKeyword({ keyword: 'x-env', schemaType: 'string' });
ajv.addKeyword({ keyword: 'x-when', schemaType: 'object' });
ajv.addKeyword({ keyword: 'x-enum-labels', schemaType: 'object' });
// A list whose items are free text (a sentence, "Question|Answer"): commas belong to the item, never split it.
ajv.addKeyword({ keyword: 'x-split', schemaType: 'boolean' });

// A long-lived process (the TUI previews and then applies) validates the same schema more than once, and Ajv
// refuses to compile a second schema with an `$id` it already knows.
const validatorFor = (schema) => (schema.$id && ajv.getSchema(schema.$id)) || ajv.compile(schema);

/**
 * Validates generator input against its JSON Schema, applying defaults and coercing CLI strings.
 * Missing required fields are reported apart from the rest, so an agent knows exactly what to send.
 */
export const validateOptions = (schema, input) => {
  const options = structuredClone(input || {});
  const validate = validatorFor(schema);
  if (validate(options)) {
    return options;
  }

  const missing = validate.errors
    .filter((error) => error.keyword === 'required')
    .map((error) => error.params.missingProperty);
  const problems = validate.errors
    .filter((error) => error.keyword !== 'required')
    .map((error) => ({
      field: error.instancePath.replace(/^\//, '') || error.params?.additionalProperty || '',
      message: error.message,
    }));

  const message = missing.length ? `Missing required input: ${missing.join(', ')}` : 'Invalid input';
  throw new LoomError(ERROR_CODES.validation, message, { missing, problems });
};
