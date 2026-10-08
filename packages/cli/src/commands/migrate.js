import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError, stringifyJson } from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { npmInstall } from './install.js';
import { estimateInstall, recordInstall } from './install-sizes.js';
import { PROJECT_FILE } from './project.js';

export const MIGRATE_ACTIONS = Object.freeze(['analyze', 'apply', 'finish']);
export const DECISIONS_FILE = 'migration.decisions.json';
export const MIGRATION_SCHEMA = 'migration';

export const MIGRATE_HELP = `Usage: link-loom migrate <action> [flags]   (temporary: moves an existing webapp onto the standard)

  analyze <repo>                         Reads the legacy app (never writes to it) and writes ${DECISIONS_FILE}, a draft
                                         of every decision. --out <file> names the draft. --json adds the inventory.
  apply --decisions <file> --out <dir>   Builds the new project in a new folder from the finished decisions, installs it
                                         and runs finish. --dry-run answers the plan and writes nothing; --no-install
                                         stops before installing (run finish after npm install).
  finish [dir]                           Formats the carried files, applies eslint's fixes, turns off per file the lint
                                         and check rules legacy code still fails, and lists the links that lead nowhere,
                                         all in MIGRATION.md. Run it again after fixing code: it drops what was fixed.

The decisions file: npx link-loom schema ${MIGRATION_SCHEMA} (every field, with what it does). Entities to rebuild
with the kit take the input of npx link-loom schema entity; sidebar rows, of npx link-loom schema nav-item.
`;

// The migrator is a temporary package: loaded only when the command runs.
const migrator = () => import('@link-loom/migrate');

const BRIEF = (
  decisionsFile,
) => `Finish ${decisionsFile} before applying it (every field: npx link-loom schema ${MIGRATION_SCHEMA}):
- project: name, slug, variant, description and descriptionEs (written natively in Spanish), brand colours, layers.
- files: every file is "move" (with its kind, domain, entity, role and name) or "discard". A name that would land on a
  file of the new project must change, or be discarded.
- entities: \`add entity\` inputs (npx link-loom schema entity) for the lists and records to rebuild with the kit; their
  legacy files are then "discard".
- texts: each text written in a component needs its key, its English and its Spanish (neutral, with "tú").
- navigation: the Spanish label of each sidebar row (and of its section and group).
- links: legacy paths written in the code that the new project serves elsewhere.
Then: npx link-loom migrate apply --decisions ${decisionsFile} --out <new folder> --dry-run, and without --dry-run.`;

const finishResult = (root, outcome) =>
  createResult({
    command: 'migrate finish',
    project: { root },
    data: outcome,
    warnings: [
      ...outcome.turnedOff.map(({ file, rules }) => `${file}: ${rules.join(', ')} turned off (listed in MIGRATION.md)`),
      ...outcome.broken,
    ],
    next: ['npm run verify'],
  });

const finishText = (outcome) =>
  `${outcome.carried} carried files formatted and linted; ${outcome.turnedOff.length} keep lint rules turned off (listed in MIGRATION.md).${
    outcome.broken.length ? `\nCould not be parsed:\n${outcome.broken.join('\n')}` : ''
  }`;

/**
 * `link-loom migrate analyze <repo>`: writes migration.decisions.json (the draft of every decision) next to where it
 * runs, and answers the inventory. `link-loom migrate apply --decisions <file> --out <dir>`: builds the new project,
 * installs it and finishes it (unless `--no-install`). `link-loom migrate finish [dir]`: formats the carried files and
 * turns off, per file, the lint rules legacy code still fails. None of them touches the legacy repo.
 */
export const runMigrate = async ({
  action,
  args = [],
  input = {},
  global = {},
  cwd,
  onStep = () => {},
  onProgress,
}) => {
  if (!MIGRATE_ACTIONS.includes(action)) {
    throw new LoomError(ERROR_CODES.usage, 'Missing or unknown migrate action', { allowed: MIGRATE_ACTIONS });
  }

  const { analyzeRepo, applyMigration, finishMigration } = await migrator();
  if (action === 'finish') {
    const root = path.resolve(cwd, args[0] || input.dir || '.');
    const outcome = finishMigration({ root });
    return { result: finishResult(root, outcome), text: finishText(outcome) };
  }

  if (action === 'analyze') {
    const repo = args[0] || input.repo;
    if (!repo || !fs.existsSync(path.resolve(cwd, repo, 'package.json'))) {
      throw new LoomError(ERROR_CODES.validation, 'migrate analyze needs the folder of the app to migrate', {
        missing: ['repo'],
        problems: [],
      });
    }

    const { inventory, decisions } = analyzeRepo(path.resolve(cwd, repo));
    const decisionsFile = input.out || DECISIONS_FILE;
    if (!global.dryRun) {
      fs.writeFileSync(path.resolve(cwd, decisionsFile), stringifyJson(decisions));
    }

    return {
      result: createResult({
        command: 'migrate analyze',
        dryRun: Boolean(global.dryRun),
        data: { inventory, decisionsFile, brief: BRIEF(decisionsFile) },
        next: [
          `Finish ${decisionsFile}`,
          `npx link-loom migrate apply --decisions ${decisionsFile} --out <new folder>`,
        ],
      }),
      text: `${inventory.routes.length} routes, ${inventory.counts.reachable} files in use, ${inventory.counts.texts} texts to move into the dictionaries.\n${global.dryRun ? '' : `Wrote ${decisionsFile}.\n`}\n${BRIEF(decisionsFile)}`,
    };
  }

  if (!input.decisions || !input.out) {
    throw new LoomError(ERROR_CODES.validation, 'migrate apply needs --decisions <file> and --out <new folder>', {
      missing: ['decisions', 'out'].filter((field) => !input[field]),
      problems: [],
    });
  }

  const decisions = JSON.parse(fs.readFileSync(path.resolve(cwd, input.decisions), 'utf8'));
  const root = path.resolve(cwd, input.out);
  if (!global.dryRun) onStep('write');
  const outcome = await applyMigration({ decisions, outDir: root, dryRun: Boolean(global.dryRun) });
  if (global.dryRun) {
    return {
      result: createResult({
        command: 'migrate apply',
        dryRun: true,
        project: { root },
        plan: outcome.plan,
        data: { pending: outcome.pending },
        warnings: outcome.pending,
        next: [`npx link-loom migrate apply --decisions ${input.decisions} --out ${input.out}`],
      }),
      text: `${outcome.plan.create.length} files would be written to ${input.out}; nothing was written.\n\n${outcome.report}`,
    };
  }

  const installs = global.install !== false;
  if (installs) {
    onStep('install');
    const { type: target, layers } = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf8'));
    const count = await npmInstall(root, {
      onProgress: onProgress && ((progress) => onProgress('install', progress)),
      estimate: onProgress ? estimateInstall({ target, layers }) : 0,
    });
    if (count) recordInstall({ target, layers, count });
    onStep('finish');
  }

  const finished = installs ? finishMigration({ root }) : null;
  return {
    result: createResult({
      command: 'migrate apply',
      project: { root },
      data: { pending: outcome.pending, report: 'MIGRATION.md', lint: finished },
      warnings: outcome.pending,
      next: installs
        ? [`cd ${input.out}`, 'npm run verify']
        : [`cd ${input.out}`, 'npm install', 'npx link-loom migrate finish', 'npm run verify'],
    }),
    text: finished ? `${outcome.report}\n${finishText(finished)}` : outcome.report,
  };
};
