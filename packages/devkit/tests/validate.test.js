import { validateOptions } from '../src/index.js';

const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', 'x-prompt': { en: 'Name', es: 'Nombre' } },
    shape: { type: 'string', enum: ['monolith', 'microservice'], default: 'monolith' },
    port: { type: 'integer' },
  },
  required: ['name'],
};

describe('validateOptions', () => {
  it('applies defaults and coerces CLI strings', () => {
    expect(validateOptions(SCHEMA, { name: 'demo', port: '3000' })).toEqual({
      name: 'demo',
      shape: 'monolith',
      port: 3000,
    });
  });

  it('lists the missing required fields apart from the rest', () => {
    expect(() => validateOptions(SCHEMA, {})).toThrow(
      expect.objectContaining({
        code: 'E_VALIDATION',
        exitCode: 2,
        details: expect.objectContaining({ missing: ['name'] }),
      }),
    );
  });

  it('reports invalid values and unknown fields', () => {
    let error;
    try {
      validateOptions(SCHEMA, { name: 'Demo', shape: 'tiny', extra: true });
    } catch (caught) {
      error = caught;
    }

    expect(error.code).toBe('E_VALIDATION');
    expect(error.details.problems.map((problem) => problem.field).sort()).toEqual(['extra', 'name', 'shape']);
  });

  it('does not mutate the input', () => {
    const input = { name: 'demo' };
    validateOptions(SCHEMA, input);

    expect(input).toEqual({ name: 'demo' });
  });
});

describe('validateOptions in a long-lived process', () => {
  it('validates the same schema with an $id more than once', () => {
    const schema = { ...SCHEMA, $id: 'test/repeated' };

    expect(validateOptions(schema, { name: 'one' }).name).toBe('one');
    expect(validateOptions({ ...schema }, { name: 'two' }).name).toBe('two');
  });
});
