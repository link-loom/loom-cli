import { ERROR_CODES, EXIT_CODES, GENERATOR_STATUS, createCheckProject, importInventory } from '@link-loom/devkit';

import { MODES } from '../cli/mode.js';
import { PROGRESS_STEPS } from '../cli/progress.js';
import { CLI_PACKAGE } from '../version.js';
import { getCollection, listCollections } from '../registry/collections.js';
import { PROJECT_COLLECTIONS, findProject } from './project.js';
import { CREATE_TARGETS, PROJECT_TYPES, projectTypeStatus } from '../registry/project-types.js';

/** The machine contract: what the CLI can do, how it answers and which codes it exits with. */
export const describeCli = () => ({
  cli: { name: CLI_PACKAGE.name, version: CLI_PACKAGE.version },
  modes: Object.values(MODES),
  exitCodes: EXIT_CODES,
  errorCodes: Object.fromEntries(Object.values(ERROR_CODES).map((kind) => [kind.code, kind.exitCode])),
  commands: [
    { command: 'create <type>', types: Object.keys(CREATE_TARGETS) },
    {
      command: 'add <generator>',
      scope: 'project (the generators of its type)',
      webapp: Object.values(getCollection('@link-loom/react-generators').generators)
        .filter((generator) => generator.status === 'available' && !['webapp', 'brand'].includes(generator.id))
        .map((generator) => generator.id),
    },
    { command: 'brand <action>', actions: ['colors', 'logo', 'assets', 'og'], scope: 'webapp project' },
    { command: 'services <action> [service]', actions: ['list', 'add', 'config'], scope: 'project' },
    { command: 'images <action> [slots]', actions: ['generate', 'optimize', 'og'], scope: 'frontend project' },
    {
      command: 'update [--check]',
      scope: 'project',
      note: 'stack ranges, stale lock entries, collection migrations, install, check and build',
    },
    { command: 'skills <action> [name]', actions: ['list', 'install', 'sync'], scope: 'project' },
    { command: 'check [--changed] [--rules a,b]', scope: 'project', exitCodes: { failed: 4 } },
    {
      command: 'mcp',
      note: 'the same commands as an MCP server over stdio (create_*, add_*, brand, check, describe, schema)',
    },
    {
      command: 'migrate <action>',
      actions: ['analyze', 'apply', 'finish'],
      note: 'temporary: moves a legacy webapp into a new folder (npx link-loom migrate --help)',
    },
    { command: 'describe [--project]', note: '--project: the inventory of the project in the working directory' },
    { command: 'schema <name>' },
  ],
  output: {
    stdout:
      'one JSON document with --json: { ok, command, dryRun, project, input, plan, data, warnings, errors, next }',
    stderr: 'progress of long runs (see progress); never part of the result',
  },
  progress: {
    commands: PROGRESS_STEPS,
    stream: 'stderr: one JSON event per line with --json; a readable line every 10% otherwise',
    event: {
      event: 'progress',
      command: 'e.g. create webapp',
      step: 'one of the command steps, then done',
      progress: 'the whole run, 0 to 100; it only grows',
      total: 100,
      message: 'e.g. Installing dependencies: 512/1203 packages in place',
      phase: 'install step only: resolving (packages found, no total yet) or installing',
      found: 'resolving: packages found so far',
      done: 'installing: packages in place',
      packages: 'installing: packages to install',
    },
    last: { step: 'done', progress: 100, message: 'Done' },
    mcp: 'a tools/call with params._meta.progressToken gets notifications/progress { progressToken, progress, total, message }',
    nonBlocking:
      'install takes one to three minutes: create with --no-install (install: false over MCP), which answers in seconds, then run npm install in the project folder in the background',
  },
  projectTypes: PROJECT_TYPES.map((projectType) => ({
    id: projectType.id,
    command: projectType.target ? `create ${projectType.target}` : null,
    defaults: projectType.defaults,
    label: projectType.label.en,
    summary: projectType.summary.en,
    status: projectTypeStatus(projectType),
  })),
  collections: listCollections().map((collection) => ({
    name: collection.name,
    version: collection.version,
    generators: Object.values(collection.generators).map(({ id, description, status }) => ({
      id,
      description,
      status,
    })),
  })),
});

export const renderDescribe = (description) =>
  [
    `${description.cli.name} ${description.cli.version}`,
    '',
    'Project types:',
    ...description.projectTypes.map(
      (type) =>
        `  ${type.label.padEnd(20)} ${(type.command || '').padEnd(16)} ${type.status === 'available' ? '' : `(${type.status})`}`,
    ),
  ].join('\n');

/**
 * `describe --project`: what the project in `cwd` holds (layers, domains, entities, pages and their paths, the
 * registries) and what can be added to it, so an agent names things that exist.
 */
export const describeProject = async (cwd) => {
  const project = findProject(cwd);
  const collectionName = PROJECT_COLLECTIONS[project.manifest.type];
  const collection = collectionName ? getCollection(collectionName) : null;
  const inventoryOf = collection ? await importInventory(collection) : null;
  const inventory = inventoryOf
    ? inventoryOf(createCheckProject({ root: project.root, manifest: project.manifest }))
    : { type: project.manifest.type };
  const generators = Object.values(collection?.generators || {})
    .filter(
      (generator) =>
        generator.status === GENERATOR_STATUS.available && ![project.manifest.type, 'brand'].includes(generator.id),
    )
    .map(({ id, description }) => ({ id, command: `add ${id}`, description }));
  return {
    root: project.root,
    collection: collection && { name: collection.name, version: collection.version },
    ...inventory,
    generators,
  };
};

export const renderProject = (description) =>
  [
    `${description.name || description.root} (${description.type}${description.variant ? `, ${description.variant}` : ''})`,
    description.layers ? `  layers: ${description.layers.join(', ')}` : null,
    description.domains ? `  domains: ${description.domains.join(', ') || '—'}` : null,
    description.entities
      ? `  entities: ${description.entities.map((entry) => `${entry.domain}/${entry.entity}`).join(', ') || '—'}`
      : null,
    description.pages && description.type === 'landing'
      ? `  pages: ${description.pages.map((page) => page.path).join(', ')}`
      : null,
    description.pages && description.type !== 'landing' ? `  pages: ${description.pages.length}` : null,
    description.posts ? `  posts: ${description.posts.map((post) => post.slug).join(', ') || '—'}` : null,
    `  add: ${description.generators.map((generator) => generator.id).join(', ') || '—'}`,
  ]
    .filter(Boolean)
    .join('\n');
