const BOOLEAN_FLAGS = new Set([
  'json',
  'dryRun',
  'yes',
  'force',
  'quiet',
  'verbose',
  'interactive',
  'help',
  'version',
  'install',
  'animation',
  'fullscreen',
  'fromEnv',
  'changed',
  'check',
  'offline',
  'ai',
]);

const SHORT_FLAGS = Object.freeze({ i: 'interactive', h: 'help', v: 'version', y: 'yes' });

// Flags that steer the CLI itself; everything else is generator input.
const GLOBAL_FLAGS = new Set([...BOOLEAN_FLAGS, 'cwd', 'input', 'template']);

const toCamel = (value) => value.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());

/**
 * Parses argv into positionals and flags without a fixed option list, because generator flags come from
 * each generator's JSON Schema. `--no-x` sets `x` to false; known booleans never swallow the next token.
 * Once the command is named, bare words after a flag's value belong to that flag (`--actions quickview copy-link`
 * is a list of two), so a list written with spaces is never cut to its first item.
 */
export const parseArgv = (argv) => {
  const positionals = [];
  const flags = {};
  let valued = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (/^-[a-zA-Z]$/.test(token)) {
      const name = SHORT_FLAGS[token.slice(1)];
      if (name) {
        flags[name] = true;
      }
      continue;
    }

    if (!token.startsWith('--') && valued && positionals.length) {
      flags[valued] = [].concat(flags[valued], token);
      continue;
    }

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    valued = null;

    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (rawName.startsWith('no-') && inlineValue === undefined) {
      flags[toCamel(rawName.slice(3))] = false;
      continue;
    }

    const name = toCamel(rawName);
    if (inlineValue !== undefined) {
      flags[name] = inlineValue;
      valued = GLOBAL_FLAGS.has(name) ? null : name;
      continue;
    }

    const next = argv[index + 1];
    if (BOOLEAN_FLAGS.has(name) || next === undefined || next.startsWith('-')) {
      flags[name] = true;
      continue;
    }

    flags[name] = next;
    valued = GLOBAL_FLAGS.has(name) ? null : name;
    index += 1;
  }

  return { positionals, flags };
};

export const splitFlags = (flags) => {
  const global = {};
  const input = {};
  for (const [name, value] of Object.entries(flags)) {
    (GLOBAL_FLAGS.has(name) ? global : input)[name] = value;
  }

  return { global, input };
};
