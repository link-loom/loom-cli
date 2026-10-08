const valueOf = (entry, options) => {
  if (entry.option === undefined) {
    return entry.value ?? '';
  }

  const value = options[entry.option];
  return value === undefined || value === null ? '' : String(value);
};

const render = (entries, line) => {
  const groups = [...new Set(entries.map((entry) => entry.group))];
  return `${groups
    .map((group) =>
      [
        `# --- ${group} ---`,
        ...entries.filter((entry) => entry.group === group).flatMap((entry) => [`# ${entry.comment}`, line(entry)]),
      ].join('\n'),
    )
    .join('\n\n')}\n`;
};

/**
 * `.env.sample` (versioned, placeholders only: no value of a secret ever lands in it) and `.env.local` (gitignored,
 * the real URLs and keys the person gave).
 */
export const composeEnv = ({ layers, options }) => {
  const entries = layers.flatMap((layer) => layer.env);
  return {
    sample: render(entries, (entry) => `${entry.key}=${entry.secret ? '' : valueOf(entry, options)}`),
    local: render(entries, (entry) => `${entry.key}=${valueOf(entry, options)}`),
  };
};
