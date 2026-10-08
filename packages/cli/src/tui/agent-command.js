import { secretFields } from '../commands/secrets.js';

const kebab = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const quote = (value) =>
  /^[\w./@:,-]+$/.test(String(value)) ? String(value) : `'${String(value).replace(/'/g, "'\\''")}'`;

const flagFor = ([name, value]) => {
  if (value === true) {
    return `--${kebab(name)}`;
  }

  if (value === false) {
    return `--no-${kebab(name)}`;
  }

  if (Array.isArray(value)) {
    return `--${kebab(name)} ${quote(value.join(','))}`;
  }

  return `--${kebab(name)} ${quote(value)}`;
};

/**
 * The deterministic command an agent would run to get the same result as the TUI: `target` is a create type
 * (`webapp`) or a whole command (`add entity`). Secrets never appear in it: they travel in their environment
 * variable, named before the command, and `--from-env` reads them.
 */
export const agentCommand = (target, values, schema = {}) => {
  const command = target.includes(' ') ? target : `create ${target}`;
  const secrets = secretFields(schema).filter(({ name }) => values[name] !== undefined && values[name] !== '');
  const secretNames = new Set(secrets.map(({ name }) => name));
  const flags = Object.entries(values)
    .filter(([name, value]) => value !== undefined && value !== '' && !secretNames.has(name))
    .map(flagFor);
  const environment = secrets.map(({ env }) => `${env}=<secret>`);

  return [...environment, `link-loom ${command}`, ...flags, ...(secrets.length ? ['--from-env'] : []), '--json'].join(
    ' ',
  );
};
