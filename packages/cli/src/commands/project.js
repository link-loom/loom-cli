import fs from 'node:fs';
import path from 'node:path';

import {
  ERROR_CODES,
  GENERATOR_STATUS,
  LoomError,
  VirtualTree,
  applyTree,
  importGenerator,
  readGeneratorSchema,
  validateOptions,
} from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { getCollection } from '../registry/collections.js';
import { coerceLists } from './create.js';
import { fillFromEnv, redactSecrets } from './secrets.js';

export const PROJECT_FILE = 'loom.json';

/** Which collection owns the generators of each project type. */
export const PROJECT_COLLECTIONS = Object.freeze({
  webapp: '@link-loom/react-generators',
  landing: '@link-loom/astro-generators',
  service: '@link-loom/node-generators',
});

/** The Link Loom project `cwd` is in: the nearest folder upwards with a loom.json. */
export const findProject = (cwd) => {
  let directory = path.resolve(cwd);
  while (!fs.existsSync(path.join(directory, PROJECT_FILE))) {
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new LoomError(ERROR_CODES.usage, `Not inside a Link Loom project: no ${PROJECT_FILE} here or above`, {
        next: ['link-loom create <type>'],
      });
    }

    directory = parent;
  }

  return { root: directory, manifest: JSON.parse(fs.readFileSync(path.join(directory, PROJECT_FILE), 'utf8')) };
};

const generatorOf = (project, generatorId) => {
  const collectionName = PROJECT_COLLECTIONS[project.manifest.type];
  const generator = collectionName ? getCollection(collectionName).generators[generatorId] : null;
  if (generator?.status !== GENERATOR_STATUS.available) {
    throw new LoomError(
      ERROR_CODES.notAvailable,
      `\`${generatorId}\` is not available for ${project.manifest.type} projects`,
      {
        status: generator?.status || GENERATOR_STATUS.planned,
      },
    );
  }

  return generator;
};

export const projectSchema = (cwd, generatorId) => readGeneratorSchema(generatorOf(findProject(cwd), generatorId));

const insideProject = (cwd) => {
  try {
    return findProject(cwd);
  } catch {
    return null;
  }
};

/**
 * The schema of an `add` generator from anywhere: the project's own collection inside a project, otherwise the
 * collection of `type` (webapp, landing, service), or the only project type that has a generator of that name.
 */
export const generatorSchema = (cwd, generatorId, type) => {
  const project = insideProject(cwd);
  if (project && !type) {
    return readGeneratorSchema(generatorOf(project, generatorId));
  }

  const types = Object.keys(PROJECT_COLLECTIONS).filter(
    (candidate) =>
      (!type || candidate === type) &&
      getCollection(PROJECT_COLLECTIONS[candidate]).generators[generatorId]?.status === GENERATOR_STATUS.available,
  );
  if (types.length === 1) {
    return readGeneratorSchema(generatorOf({ manifest: { type: types[0] } }, generatorId));
  }

  if (types.length > 1) {
    throw new LoomError(
      ERROR_CODES.usage,
      `\`${generatorId}\` exists for ${types.join(' and ')} projects; pass --type`,
      {
        allowed: types,
        next: types.map((candidate) => `link-loom schema ${generatorId} --type ${candidate}`),
      },
    );
  }

  throw new LoomError(ERROR_CODES.notAvailable, `No project type has a \`${generatorId}\` generator`, {
    status: GENERATOR_STATUS.planned,
  });
};

/**
 * Runs a generator of the project's own collection against the project folder. Like `create`, a dry run returns the
 * plan; changing or deleting existing files needs `--yes` (E_CONFIRMATION_REQUIRED otherwise), so an agent always
 * sees the plan before it overwrites anything.
 */
export const runProjectGenerator = async ({ command, generatorId, input, global = {}, cwd, env = process.env }) => {
  const project = findProject(cwd);
  const generator = generatorOf(project, generatorId);
  const schema = readGeneratorSchema(generator);
  const listed = coerceLists(schema, input);
  const options = validateOptions(schema, global.fromEnv ? fillFromEnv(schema, listed, env) : listed);
  const tree = new VirtualTree({ root: project.root });
  const generate = await importGenerator(generator);
  const outcome = await generate(tree, options, { project: project.manifest, projectRoot: project.root });
  const plan = tree.plan();
  const result = {
    command,
    project: { root: project.root, type: project.manifest.type, ...outcome.project },
    input: redactSecrets(schema, options),
    plan,
    warnings: outcome.warnings || [],
    next: outcome.next || [],
  };

  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  const touchesExisting = plan.modify.length > 0 || plan.delete.length > 0;
  if (touchesExisting && !global.yes) {
    throw new LoomError(
      ERROR_CODES.confirmationRequired,
      `${command} changes existing files; review the plan and pass --yes`,
      {
        plan,
        next: ['Run it again with --yes to apply it'],
      },
    );
  }

  applyTree(tree);
  return createResult(result);
};
