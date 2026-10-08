import { execFileSync } from 'node:child_process';

import { ERROR_CODES, LoomError, createCheckProject, importCheckRules, runChecks } from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { getCollection } from '../registry/collections.js';
import { PROJECT_COLLECTIONS, findProject } from './project.js';

const git = (root, args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** The project's files git sees as changed or new, relative to the project folder. */
const changedFiles = (root) => {
  try {
    const prefix = git(root, ['rev-parse', '--show-prefix']).trim();
    const lines = git(root, ['status', '--porcelain', '--untracked-files=all', '--', '.']).split('\n').filter(Boolean);
    return new Set(
      lines
        .map((line) => line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g, ''))
        .map((file) => file.slice(prefix.length)),
    );
  } catch {
    throw new LoomError(ERROR_CODES.usage, '`check --changed` needs the project inside a git repository', {
      next: ['link-loom check'],
    });
  }
};

const listOf = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(',')).map((item) => String(item).trim()).filter(Boolean);

/** The report as lines for a person: one per rule, with its problems under it. */
export const renderCheck = (report) =>
  report.checks
    .flatMap((check) => [
      `${check.ok ? '✓' : check.severity === 'error' ? '✗' : '!'} ${check.id}${check.ok ? '' : ` (${check.problems.length})`}  ${check.summary}${
        check.waived ? ` [${check.waived.length} waived in carried files: MIGRATION.md]` : ''
      }`,
      ...check.problems.map(
        (problem) => `    ${problem.file}${problem.line ? `:${problem.line}` : ''}  ${problem.message}`,
      ),
    ])
    .join('\n');

/**
 * `link-loom check [--changed] [--rules a,b]`: the quality gate of the project's collection. Exit 4 with every
 * failing rule when any error remains; warnings never fail it. `--changed` inspects only what git sees as changed
 * (the project-wide rules, such as i18n parity, still look at everything).
 */
export const runCheck = async ({ input = {}, global = {}, cwd, stderr }) => {
  const project = findProject(cwd);
  const collectionName = PROJECT_COLLECTIONS[project.manifest.type];
  const rules = collectionName ? await importCheckRules(getCollection(collectionName)) : [];
  const targets = global.changed ? changedFiles(project.root) : undefined;
  const report = runChecks({
    rules,
    project: createCheckProject({ root: project.root, manifest: project.manifest, targets }),
    only: listOf(input.rules),
  });

  if (!report.ok) {
    if (!global.json) {
      stderr.write(`${renderCheck(report)}\n`);
    }

    throw new LoomError(ERROR_CODES.checkFailed, `${report.errors} check(s) failed`, {
      checks: report.checks.filter((check) => !check.ok),
    });
  }

  return {
    result: createResult({
      command: 'check',
      project: { root: project.root, type: project.manifest.type },
      data: report,
      warnings: [
        ...report.checks.filter((check) => !check.ok).map((check) => `${check.id}: ${check.problems.length} to review`),
        ...report.checks
          .filter((check) => check.waived)
          .map((check) => `${check.id}: ${check.waived.length} waived in carried files (MIGRATION.md)`),
      ],
    }),
    text: renderCheck(report),
  };
};
