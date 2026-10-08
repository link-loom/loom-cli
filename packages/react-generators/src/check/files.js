/** Helpers the rules share: which files are source, how a source maps to its test. */

export const SOURCE = /^src\/.*\.(js|jsx)$/;
export const JSX_SOURCE = /^src\/.*\.jsx$/;

export const isSource = (file) => SOURCE.test(file);

/** Where a source file's unit test lives: same path under tests/, without the .component/.hook suffix. */
export const testPathsOf = (file) => {
  const base = file
    .replace(/^src\//, 'tests/')
    .replace(/\.(component|hook)\.(jsx|js)$/, '')
    .replace(/\.(jsx|js)$/, '');
  return [`${base}.test.js`, `${base}.test.jsx`];
};

/** The source file a unit test mirrors, as the candidates it may be. */
export const sourcesOf = (testFile) => {
  const base = testFile.replace(/^tests\//, 'src/').replace(/\.test\.(jsx|js)$/, '');
  return [
    `${base}.js`,
    `${base}.jsx`,
    `${base}.component.jsx`,
    `${base}.component.js`,
    `${base}.hook.js`,
    `${base}.hook.jsx`,
  ];
};

export const lineOf = (node) => node?.loc?.start.line;
