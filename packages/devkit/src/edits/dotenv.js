const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

const quote = (value) => (/[\s#"']/.test(String(value)) ? `"${String(value).replace(/"/g, '\\"')}"` : String(value));

/** Sets or appends keys in a dotenv text, keeping comments, blank lines and the order of existing keys. */
export const setDotenv = (text, values) => {
  const pending = new Map(Object.entries(values));
  const lines = String(text || '')
    .split('\n')
    .map((line) => {
      const match = line.match(LINE);
      if (!match || !pending.has(match[1])) {
        return line;
      }

      const value = pending.get(match[1]);
      pending.delete(match[1]);
      return `${match[1]}=${quote(value)}`;
    });

  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }

  for (const [key, value] of pending) {
    lines.push(`${key}=${quote(value)}`);
  }

  return `${lines.join('\n')}\n`;
};

export const readDotenv = (text) =>
  Object.fromEntries(
    String(text || '')
      .split('\n')
      .map((line) => line.match(LINE))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^"(.*)"$/, '$1')]),
  );
