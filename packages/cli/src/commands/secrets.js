/** Fields the schema marks as secret (`x-secret`), with the environment variable that can carry them (`x-env`). */
export const secretFields = (schema) =>
  Object.entries(schema.properties || {})
    .filter(([, property]) => property['x-secret'])
    .map(([name, property]) => ({ name, env: property['x-env'] }));

export const REDACTED = '[secret]';

/** `--from-env`: every field with an `x-env` the input leaves out is read from that environment variable. */
export const fillFromEnv = (schema, input, env) => {
  const filled = { ...input };
  for (const [name, property] of Object.entries(schema.properties || {})) {
    const variable = property['x-env'];
    if (!variable || filled[name] !== undefined || env[variable] === undefined) {
      continue;
    }

    filled[name] = env[variable];
  }

  return filled;
};

/** The input as it may be shown: secret values are replaced, so they never reach stdout, JSON or logs. */
export const redactSecrets = (schema, input) => {
  if (!input) {
    return input;
  }

  const redacted = { ...input };
  for (const { name } of secretFields(schema)) {
    if (redacted[name] !== undefined) {
      redacted[name] = REDACTED;
    }
  }

  return redacted;
};
