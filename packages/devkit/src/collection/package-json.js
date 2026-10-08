import { stringifyJson } from '../edits/json.js';

const pick = (names, versions, kind) =>
  Object.fromEntries(
    [...names].sort().map((name) => {
      if (!versions[name]) {
        throw new Error(`stack.json has no ${kind} version for ${name}`);
      }

      return [name, versions[name]];
    }),
  );

/**
 * A generated project's package.json from its active layers: their scripts, and their dependencies at the versions
 * of the collection's stack manifest. Projects start at 0.0.1.
 */
export const composePackageJson = ({ slug, description, layers, stack }) => {
  const dependencies = new Set(layers.flatMap((layer) => layer.dependencies));
  const devDependencies = new Set(layers.flatMap((layer) => layer.devDependencies));
  const scripts = Object.assign({}, ...layers.map((layer) => layer.scripts));

  return stringifyJson({
    name: slug,
    private: true,
    version: '0.0.1',
    description,
    type: 'module',
    engines: { node: '>=22' },
    scripts,
    dependencies: pick(dependencies, stack.dependencies, 'dependency'),
    devDependencies: pick(devDependencies, stack.devDependencies, 'devDependency'),
  });
};
