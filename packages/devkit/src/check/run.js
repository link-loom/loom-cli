import fs from 'node:fs';
import path from 'node:path';

import { toPosix } from '../tree/paths.js';
import { parseSource } from './ast.js';

export const CHECK_SEVERITIES = Object.freeze({ error: 'error', warning: 'warning' });

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.vite', '.claude', '.agent']);

/** Every file of a project, relative and POSIX, without dependencies, builds or agent folders. */
export const listProjectFiles = (root, directory = root) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listProjectFiles(root, path.join(directory, entry.name));
    }

    return [toPosix(path.relative(root, path.join(directory, entry.name)))];
  });

/**
 * The project as the rules see it: every file, the ones to inspect (all, or the changed ones), a cached reader and
 * a cached parser. A rule answers `[{ file, line?, message }]`.
 */
export const createCheckProject = ({ root, manifest, targets }) => {
  const files = listProjectFiles(root);
  const texts = new Map();
  const asts = new Map();
  const read = (file) => {
    if (!texts.has(file)) {
      const fullPath = path.join(root, file);
      texts.set(file, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
    }

    return texts.get(file);
  };

  return {
    root,
    manifest,
    files,
    targets: targets ? files.filter((file) => targets.has(file)) : files,
    exists: (file) => files.includes(file),
    read,
    ast: (file) => {
      if (!asts.has(file)) {
        asts.set(file, parseSource(read(file) || '', file));
      }

      return asts.get(file);
    },
  };
};

/**
 * Runs every rule (or the ones in `only`) and answers `{ ok, errors, warnings, checks }`; ok means no errors. A
 * migrated project lists, per carried file, the rules its legacy code still fails (`loom.json` `migration.waivers`):
 * those problems come back under `waived`, visible but not failing.
 */
export const runChecks = ({ rules, project, only = [] }) => {
  const selected = only.length ? rules.filter((rule) => only.includes(rule.id)) : rules;
  const waivers = project.manifest?.migration?.waivers || {};
  const checks = selected.map((rule) => {
    const found = rule.run(project);
    const isWaived = (problem) => (waivers[problem.file] || []).includes(rule.id);
    const problems = found.filter((problem) => !isWaived(problem));
    const waived = found.filter(isWaived);
    return {
      id: rule.id,
      severity: rule.severity,
      summary: rule.summary,
      ok: problems.length === 0,
      problems,
      ...(waived.length ? { waived } : {}),
    };
  });
  const failing = (severity) => checks.filter((check) => !check.ok && check.severity === severity).length;
  return {
    ok: failing(CHECK_SEVERITIES.error) === 0,
    errors: failing(CHECK_SEVERITIES.error),
    warnings: failing(CHECK_SEVERITIES.warning),
    checks,
  };
};
