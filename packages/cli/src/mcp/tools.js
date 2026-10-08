import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GENERATOR_STATUS, readGeneratorSchema } from '@link-loom/devkit';

import { getCollection } from '../registry/collections.js';
import { CREATE_TARGETS, generatorFor } from '../registry/project-types.js';
import { PROJECT_COLLECTIONS } from '../commands/project.js';

const FLAG = (description) => ({ type: 'boolean', description });

const withFlags = (schema, flags) => ({
  type: 'object',
  properties: { ...(schema?.properties || {}), ...flags },
  ...(schema?.required?.length ? { required: schema.required } : {}),
});

/** The project the server runs in, if any: its loom.json. */
const projectManifest = (cwd) => {
  let directory = path.resolve(cwd);
  for (;;) {
    const file = path.join(directory, 'loom.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }

    directory = parent;
  }
};

const BASE_TOOLS = [
  {
    name: 'describe',
    description:
      'What the Link Loom CLI can do; with project: true, what the project holds (layers, domains, entities, pages and their paths, registries) and what can be added to it',
    inputSchema: { type: 'object', properties: { project: FLAG('Describe the project in the working directory') } },
    argv: (input) => ['describe', ...(input.project ? ['--project'] : [])],
  },
  {
    name: 'schema',
    description: 'The JSON Schema of a generator: a create type (landing, webapp, service) or an add generator',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    argv: (input) => ['schema', input.name],
  },
  {
    name: 'check',
    description: 'The quality gate of the project: every rule with its problems; fails when a rule with errors fails',
    inputSchema: {
      type: 'object',
      properties: {
        changed: FLAG('Inspect only what git sees as changed'),
        rules: { type: 'array', items: { type: 'string' }, description: 'Only these rules' },
      },
    },
    argv: (input) => [
      'check',
      ...(input.changed ? ['--changed'] : []),
      ...(input.rules?.length ? ['--rules', input.rules.join(',')] : []),
    ],
  },
];

/**
 * The tools the server offers in `cwd`: describe, schema and check always; create_<type> outside a project; inside
 * one, add_<generator> for each generator of its collection and brand for a webapp. Each tool's input is the
 * generator's own JSON Schema plus dryRun (and yes, to change existing files).
 */
export const listTools = (cwd) => {
  const manifest = projectManifest(cwd);
  if (!manifest) {
    const creates = Object.keys(CREATE_TARGETS)
      .map((target) => ({ target, generator: generatorFor(target) }))
      .filter(({ generator }) => generator?.status === GENERATOR_STATUS.available)
      .map(({ target, generator }) => ({
        name: `create_${target}`,
        description: generator.description,
        inputSchema: withFlags(readGeneratorSchema(generator), {
          dryRun: FLAG('Answer the plan and write nothing'),
          install: FLAG(
            'Run npm install after creating (default true). It takes one to three minutes; with a progressToken the call reports it as notifications/progress. false answers in seconds: then run `npm install` in the project folder in the background and keep working',
          ),
        }),
        argv: (input) => [
          'create',
          target,
          ...(input.dryRun ? ['--dry-run'] : []),
          ...(input.install === false ? ['--no-install'] : []),
        ],
        flags: ['dryRun', 'install'],
      }));
    return [...BASE_TOOLS, ...creates];
  }

  const collectionName = PROJECT_COLLECTIONS[manifest.type];
  const generators = collectionName ? Object.values(getCollection(collectionName).generators) : [];
  const adds = generators
    .filter((generator) => generator.status === GENERATOR_STATUS.available && generator.id !== manifest.type)
    .map((generator) => {
      const isBrand = generator.id === 'brand';
      return {
        name: isBrand ? 'brand' : `add_${generator.id}`,
        description: generator.description,
        inputSchema: withFlags(readGeneratorSchema(generator), {
          dryRun: FLAG('Answer the plan and write nothing'),
          yes: FLAG('Confirm changes to existing files (read the plan of a dry run first)'),
        }),
        argv: (input) =>
          isBrand
            ? ['brand', input.action, ...(input.dryRun ? ['--dry-run'] : []), ...(input.yes ? ['--yes'] : [])]
            : ['add', generator.id, ...(input.dryRun ? ['--dry-run'] : []), ...(input.yes ? ['--yes'] : [])],
        flags: ['dryRun', 'yes', ...(isBrand ? ['action'] : [])],
      };
    });
  return [...BASE_TOOLS, ...adds];
};

/** The generator input of a tool call, as a temporary --input file: everything but the tool's own flags. */
export const inputFile = (tool, input) => {
  const generatorInput = Object.fromEntries(
    Object.entries(input || {}).filter(([name]) => !(tool.flags || []).includes(name)),
  );
  if (!tool.flags || !Object.keys(generatorInput).length) {
    return null;
  }

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'link-loom-mcp-')), 'input.json');
  fs.writeFileSync(file, JSON.stringify(generatorInput));
  return file;
};
