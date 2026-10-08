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
import { CREATE_TARGETS, generatorFor } from '../registry/project-types.js';
import { npmInstall } from './install.js';
import { estimateInstall, recordInstall } from './install-sizes.js';
import { fillFromEnv, redactSecrets } from './secrets.js';

export const CREATE_STEPS = Object.freeze({ render: 'render', write: 'write', install: 'install' });

const assertTarget = (target) => {
  if (!target) {
    throw new LoomError(ERROR_CODES.usage, 'Missing project type', { allowed: Object.keys(CREATE_TARGETS) });
  }

  if (!CREATE_TARGETS[target]) {
    throw new LoomError(ERROR_CODES.usage, `Unknown project type: ${target}`, { allowed: Object.keys(CREATE_TARGETS) });
  }

  const generator = generatorFor(target);
  if (generator?.status !== GENERATOR_STATUS.available) {
    throw new LoomError(ERROR_CODES.notAvailable, `\`create ${target}\` is planned and not available yet`, {
      status: generator?.status || GENERATOR_STATUS.planned,
    });
  }

  return generator;
};

export const createSchema = (target) => readGeneratorSchema(assertTarget(target));

const parseList = (name, value) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new LoomError(ERROR_CODES.validation, `${name} is not a list: use a,b,c or a JSON array`, {
      missing: [],
      problems: [{ field: name, message: 'not a list' }],
    });
  }
};

// A flag carries a list as `a,b,c` (or as JSON); the schema says which fields are lists.
/** A flag given several words (`--name Acme Workspace`) where the schema takes one value: the words were not quoted. */
const unquotedWords = (name, words) => {
  const flag = `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  return new LoomError(ERROR_CODES.validation, `${flag} takes one value but got ${words.length} words; quote it`, {
    missing: [],
    problems: [{ field: name, message: `quote the value: ${flag} "${words.join(' ')}"` }],
  });
};

export const coerceLists = (schema, input) =>
  Object.fromEntries(
    Object.entries(input || {}).map(([name, value]) => {
      const isList = schema.properties?.[name]?.type === 'array';
      if (Array.isArray(value) && !isList && value.every((item) => typeof item === 'string')) {
        throw unquotedWords(name, value);
      }

      // Free-text items (x-split: false) are one item per value; other lists also take a,b,c in one value.
      const split = schema.properties?.[name]?.['x-split'] !== false;
      const listOf = (item) => (split || item.trim().startsWith('[') ? parseList(name, item) : [item]);
      if (isList && Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        return [name, value.flatMap(listOf)];
      }

      return [name, isList && typeof value === 'string' ? listOf(value) : value];
    }),
  );

// Created without installing: the project needs `npm install` before anything after `cd` runs.
const withInstall = (next = []) => {
  if (next.includes('npm install')) return next;
  const at = next.findIndex((step) => step.startsWith('cd ')) + 1;
  return [...next.slice(0, at), 'npm install', ...next.slice(at)];
};

/**
 * Runs a create generator against a virtual tree rooted at `cwd`. A dry run returns the plan and writes nothing;
 * otherwise the tree is applied atomically and, unless `install` is false, dependencies are installed (`onProgress`
 * follows how many packages are in place). Secrets
 * (`x-secret`) can come from the environment with `--from-env` and are never echoed back.
 */
export const runCreate = async ({
  target,
  input,
  global = {},
  cwd,
  env = process.env,
  onStep = () => {},
  onProgress,
}) => {
  const generator = assertTarget(target);
  const schema = readGeneratorSchema(generator);
  const listed = coerceLists(schema, input);
  const options = validateOptions(schema, global.fromEnv ? fillFromEnv(schema, listed, env) : listed);
  const tree = new VirtualTree({ root: cwd });
  const generate = await importGenerator(generator);

  onStep(CREATE_STEPS.render);
  const outcome = await generate(tree, options, {
    templateDir: global.template ? path.resolve(cwd, global.template) : undefined,
  });
  const plan = tree.plan();
  const command = `create ${target}`;
  const hasDependencies = outcome.installIn !== undefined && outcome.installIn !== null;
  const result = {
    command,
    project: outcome.project,
    input: redactSecrets(schema, options),
    plan,
    warnings: outcome.warnings,
    next: hasDependencies && global.install === false ? withInstall(outcome.next) : outcome.next,
  };

  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  // The folder the project lands in travels with the steps, so a run stopped halfway can say what to do with it.
  const folder = outcome.installIn ?? null;
  onStep(CREATE_STEPS.write, { folder });
  applyTree(tree);

  if (hasDependencies && global.install !== false) {
    onStep(CREATE_STEPS.install, { folder });
    const layers = outcome.project?.layers || [];
    const count = await npmInstall(path.join(cwd, outcome.installIn), {
      onProgress: onProgress && ((progress) => onProgress(CREATE_STEPS.install, progress)),
      estimate: onProgress ? estimateInstall({ target, layers, env }) : 0,
    });
    if (count) recordInstall({ target, layers, count, env });
  }

  return createResult(result);
};
