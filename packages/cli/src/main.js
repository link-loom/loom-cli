import path from 'node:path';

import { ERROR_CODES, EXIT_CODES, LoomError, isLoomError } from '@link-loom/devkit';

import { MODES, resolveMode } from './cli/mode.js';
import { createErrorResult, createResult, writeResult } from './cli/output.js';
import { parseArgv, splitFlags } from './cli/parse.js';
import { createSchema, runCreate } from './commands/create.js';
import { CREATE_TARGETS } from './registry/project-types.js';
import { describeCli, describeProject, renderDescribe, renderProject } from './commands/describe.js';
import { HELP_TEXT, renderSchemaHelp } from './commands/help.js';
import { resolveInput } from './commands/input.js';
import { redactSecrets } from './commands/secrets.js';
import { generatorSchema, runProjectGenerator } from './commands/project.js';
import { runServices } from './commands/services.js';
import { runImages } from './commands/images.js';
import { runCheck } from './commands/check.js';
import { runSkills } from './commands/skills.js';
import { runUpdate } from './commands/update.js';
import { runAi } from './commands/ai.js';
import { MIGRATE_HELP, MIGRATION_SCHEMA, runMigrate } from './commands/migrate.js';
import { PROGRESS_STEPS, progressLine, progressReporter } from './cli/progress.js';
import { CLI_VERSION } from './version.js';

const LEGACY_CREATE_WARNING =
  '`link-loom create --name <name>` is deprecated; use `link-loom create service --name <name>`';

const COMMANDS = Object.freeze([
  'create',
  'add',
  'brand',
  'services',
  'images',
  'skills',
  'check',
  'describe',
  'schema',
  'mcp',
  'ai',
  'migrate',
]);

export const BRAND_ACTIONS = Object.freeze(['colors', 'logo', 'assets', 'og']);

// Inside a project the TUI opens on what can be added to it; anywhere else, on what can be created.
const projectOf = async (cwd) => {
  try {
    return await describeProject(cwd);
  } catch {
    return null;
  }
};

const openTui = async (options) => {
  const { runTui } = await import('./tui/index.js');
  return runTui({ ...options, project: options.target ? null : await projectOf(options.cwd) });
};

const createTarget = (args, input) => args[0] || (input?.name ? 'service' : undefined);

// Ten-point steps for a log a person reads; every point (as JSON lines) for an agent.
const PLAIN_EVERY = 10;

/**
 * How a long run (create, update, migrate apply) reports its progress on stderr, so stdout keeps its single result:
 * with --json one JSON event per line (what MCP turns into notifications/progress), otherwise a readable line every
 * few percent. A dry run reports nothing.
 */
const progressOf = ({ command, kind = command, global, json, stderr }) => {
  if (global.dryRun) return null;
  // Without installing, the steps after it are not taken either.
  const steps = PROGRESS_STEPS[kind];
  let shown = { step: null, progress: -PLAIN_EVERY };
  return progressReporter({
    command,
    steps: global.install === false ? steps.slice(0, steps.indexOf('install')) : steps,
    emit: (event) => {
      if (json) {
        stderr.write(`${JSON.stringify(event)}\n`);
        return;
      }

      const due = event.step !== shown.step || event.progress >= shown.progress + PLAIN_EVERY || event.progress === 100;
      if (!due) return;
      shown = { step: event.step, progress: event.progress };
      stderr.write(progressLine(event));
    },
  });
};

const dispatch = async ({ command, args, input, global, cwd, env, json, stderr }) => {
  if (command === 'create') {
    const target = createTarget(args, input);
    const legacy = !args[0] && target === 'service';
    const reporter = progressOf({ command: `create ${target}`, kind: 'create', global, json, stderr });
    const result = await runCreate({
      target,
      input,
      global,
      cwd,
      env,
      onStep: reporter?.onStep,
      onProgress: reporter?.onProgress,
    });
    reporter?.done();
    if (legacy) {
      result.warnings.unshift(LEGACY_CREATE_WARNING);
    }

    return { result };
  }

  if (command === 'add') {
    if (!args[0]) {
      throw new LoomError(ERROR_CODES.usage, 'Missing what to add, e.g. `link-loom add entity`', {
        next: ['link-loom describe --json'],
      });
    }

    const result = await runProjectGenerator({
      command: `add ${args[0]}`,
      generatorId: args[0],
      input,
      global,
      cwd,
      env,
    });
    return { result };
  }

  if (command === 'brand') {
    if (!BRAND_ACTIONS.includes(args[0])) {
      throw new LoomError(ERROR_CODES.usage, 'Missing or unknown brand action', { allowed: BRAND_ACTIONS });
    }

    const result = await runProjectGenerator({
      command: `brand ${args[0]}`,
      generatorId: 'brand',
      input: { ...input, action: args[0] },
      global,
      cwd,
      env,
    });
    return { result };
  }

  if (command === 'services') {
    const result = await runServices({ action: args[0], serviceId: args[1], input, global, cwd, env });
    return { result, text: renderServices(result) };
  }

  if (command === 'images') {
    const onProgress = json
      ? undefined
      : (outcome) =>
          stderr.write(`${outcome.ok ? '✓' : '✗'} ${outcome.slot} ${outcome.ok ? outcome.file : outcome.error}\n`);
    const result = await runImages({ action: args[0], args: args.slice(1), input, global, cwd, env, onProgress });
    return { result };
  }

  if (command === 'update') {
    const reporter = input.check || global.check ? null : progressOf({ command, global, json, stderr });
    const result = await runUpdate({ input, global, cwd, onStep: reporter?.onStep, onProgress: reporter?.onProgress });
    reporter?.done();
    return { result };
  }

  if (command === 'skills') {
    return { result: await runSkills({ action: args[0], name: args[1], global, cwd }) };
  }

  if (command === 'check') {
    return runCheck({ input, global, cwd, stderr });
  }

  if (command === 'migrate') {
    const reporter = args[0] === 'apply' ? progressOf({ command: 'migrate apply', global, json, stderr }) : null;
    const outcome = await runMigrate({
      action: args[0],
      args: args.slice(1),
      input,
      global,
      cwd,
      onStep: reporter?.onStep,
      onProgress: reporter?.onProgress,
    });
    reporter?.done();
    return outcome;
  }

  if (command === 'ai') {
    const onProgress = json ? undefined : (outcome) => stderr.write(`✓ ${outcome.file}\n`);
    return runAi({ action: args[0], args: args.slice(1), input, global, cwd, env, onProgress });
  }

  if (command === 'describe' && input?.project) {
    const description = await describeProject(cwd);
    return {
      result: createResult({ command: 'describe --project', data: description }),
      text: renderProject(description),
    };
  }

  if (command === 'describe') {
    const description = describeCli();
    return { result: createResult({ command, data: description }), text: renderDescribe(description) };
  }

  if (command === 'schema' && args[0] === MIGRATION_SCHEMA) {
    const { DECISIONS_SCHEMA } = await import('@link-loom/migrate');
    return {
      result: createResult({ command: `schema ${MIGRATION_SCHEMA}`, data: DECISIONS_SCHEMA }),
      text: JSON.stringify(DECISIONS_SCHEMA, null, 2),
    };
  }

  if (command === 'schema') {
    const schema = CREATE_TARGETS[args[0]] ? createSchema(args[0]) : generatorSchema(cwd, args[0], input?.type);
    return {
      result: createResult({ command: `schema ${args[0]}`, data: schema }),
      text: JSON.stringify(schema, null, 2),
    };
  }

  throw new LoomError(ERROR_CODES.unknownCommand, `Unknown command: ${command}`, { allowed: COMMANDS });
};

/** `create <type> --help`, `add <generator> --help` (and `help create <type>`): that generator's flags. */
const commandHelp = ({ command, args, flags, cwd }) => {
  const [verb, name] = command === 'help' ? args : [command, args[0]];
  try {
    if (verb === 'create' && CREATE_TARGETS[name]) {
      return renderSchemaHelp({ usage: `link-loom create ${name} [flags]`, schema: createSchema(name) });
    }

    if (verb === 'add' && name) {
      return renderSchemaHelp({
        usage: `link-loom add ${name} [flags]`,
        schema: generatorSchema(cwd, name, flags.type),
      });
    }

    if (verb === 'migrate') {
      return MIGRATE_HELP;
    }

    if (verb === 'brand') {
      return renderSchemaHelp({
        usage: 'link-loom brand <colors|logo|assets|og> [flags]',
        schema: generatorSchema(cwd, 'brand', flags.type),
      });
    }
  } catch (error) {
    // A generator two project types have: say how to pick one instead of printing the general help.
    return error.details?.next
      ? `${error.message}:\n${error.details.next.map((line) => `  ${line}`).join('\n')}\n`
      : null;
  }

  return null;
};

// An error result echoes the input too, so secrets are redacted there as well; an unknown target has no schema.
const redactedCreateInput = (target, input) => {
  try {
    return redactSecrets(createSchema(target), input);
  } catch {
    return input;
  }
};

const renderServices = (result) =>
  result.data.services
    ?.map(
      (service) =>
        `${service.active ? '●' : '○'} ${service.id.padEnd(18)} ${service.keys
          .map((key) => `${key.key}${key.set ? '' : ' (missing)'}`)
          .join(', ')}`,
    )
    .join('\n');

const wantsWizard = (error, command, mode) =>
  mode === MODES.human &&
  (command === 'create' || command === 'add') &&
  isLoomError(error) &&
  (error.code === ERROR_CODES.validation.code || error.code === ERROR_CODES.usage.code);

export const run = async (argv, io = {}) => {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const stdin = io.stdin || process.stdin;
  const env = io.env || process.env;

  const { positionals, flags } = parseArgv(argv);
  const { global, input: flagInput } = splitFlags(flags);
  const mode = resolveMode({ global, env, stdin, stdout });
  const json = Boolean(global.json);
  const cwd = path.resolve(global.cwd || process.cwd());
  const [command, ...args] = positionals;

  if (global.version) {
    stdout.write(`${CLI_VERSION}\n`);
    return EXIT_CODES.ok;
  }

  if (global.help || command === 'help') {
    stdout.write(commandHelp({ command, args, flags: flagInput, cwd }) || HELP_TEXT);
    return EXIT_CODES.ok;
  }

  if (!command) {
    if (mode === MODES.human) {
      return openTui({ cwd, global, env });
    }

    if (json) {
      writeResult(createResult({ command: 'describe', data: describeCli() }), { json, stdout, stderr });
      return EXIT_CODES.ok;
    }

    stdout.write(HELP_TEXT);
    return EXIT_CODES.ok;
  }

  if (command === 'mcp') {
    const { serveMcp } = await import('./mcp/server.js');
    await serveMcp({ cwd, stdin, stdout, env });
    return EXIT_CODES.ok;
  }

  let input = null;
  try {
    input = resolveInput({ global, flags: flagInput, cwd, stdin });
    // A person who types a whole create command sees Loomi at work and what it made; a missing field opens the
    // wizard there. Agents (and dry runs) keep the plain result.
    const typedCreate = command === 'create' && createTarget(args, input) && !global.dryRun;
    if (typedCreate && mode === MODES.human) {
      return openTui({ cwd, global, env, target: createTarget(args, input), prefill: input || {}, autoRun: true });
    }

    const { result, text } = await dispatch({ command, args, input, global, cwd, env, json, stderr });
    if (!json && text) {
      stdout.write(`${text}\n`);
      return EXIT_CODES.ok;
    }

    writeResult(result, { json, stdout, stderr });
    return EXIT_CODES.ok;
  } catch (error) {
    if (wantsWizard(error, command, mode)) {
      const target = command === 'create' ? createTarget(args, input) : undefined;
      const generator = command === 'add' ? args[0] : undefined;
      return openTui({ cwd, global, env, target, generator, prefill: input || {} });
    }

    const shownInput = command === 'create' ? redactedCreateInput(createTarget(args, input), input) : input;
    writeResult(
      createErrorResult({
        command: [command, ...args].join(' '),
        error,
        input: shownInput,
        dryRun: Boolean(global.dryRun),
      }),
      {
        json,
        stdout,
        stderr,
      },
    );
    return isLoomError(error) ? error.exitCode : EXIT_CODES.failure;
  }
};
