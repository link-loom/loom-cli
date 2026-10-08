import { addEntries, parseSource } from '@link-loom/devkit';

/**
 * Brings the legacy theme's exports into the new theme.js: an export the new one lacks is added as it was, so the
 * components that import it keep working; one both have keeps the new value (the brand of the project decisions).
 */
export const mergeTheme = (current, legacy) => {
  const exportedNames = (source) => {
    const ast = parseSource(source, 'theme.js');
    return new Map(
      (ast?.program.body || [])
        .filter(
          (statement) =>
            statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration',
        )
        .flatMap((statement) =>
          statement.declaration.declarations.map((declarator) => [
            declarator.id.name,
            source.slice(statement.start, statement.end),
          ]),
        ),
    );
  };

  const present = exportedNames(current);
  const legacyExports = exportedNames(legacy);
  const added = [...legacyExports].filter(([name]) => !present.has(name));
  let merged = added.length
    ? `${current.trimEnd()}\n\n// Carried over from the legacy theme.\n${added.map(([, text]) => text).join('\n\n')}\n`
    : current;
  const notes = [];

  // An object both themes export keeps the new values and gains the keys only the legacy one had.
  for (const name of [...legacyExports.keys()].filter((candidate) => present.has(candidate))) {
    const entries = objectEntriesOf(legacy, name);
    if (!entries) {
      notes.push(`src/constants/theme.js: ${name} keeps the new project's value; the legacy one was not an object`);
      continue;
    }

    const { source, conflicts } = addEntries(merged, { name, entries, file: 'theme.js' });
    merged = source;
    if (Object.keys(entries).length > conflicts.length) {
      notes.push(
        `src/constants/theme.js: ${name} gained the legacy keys ${Object.keys(entries)
          .filter((key) => !conflicts.includes(key))
          .join(', ')}`,
      );
    }
  }

  return { source: merged, notes };
};

/** The properties of `export const <name> = { … }` as source text, by key. */
const objectEntriesOf = (source, name) => {
  const ast = parseSource(source, 'theme.js');
  const declarator = (ast?.program.body || [])
    .filter(
      (statement) =>
        statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration',
    )
    .flatMap((statement) => statement.declaration.declarations)
    .find((candidate) => candidate.id.name === name);
  const object = declarator?.init?.type === 'CallExpression' ? declarator.init.arguments[0] : declarator?.init;
  if (object?.type !== 'ObjectExpression') return null;
  return Object.fromEntries(
    object.properties
      .filter((property) => property.type === 'ObjectProperty')
      .map((property) => [
        property.key.name ?? property.key.value,
        source.slice(property.value.start, property.value.end),
      ]),
  );
};
