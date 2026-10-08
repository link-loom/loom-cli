import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError, createCheckProject, parseSource, runChecks, walkAst } from '@link-loom/devkit';
import { RULES } from '@link-loom/react-generators/src/check/index.js';
import { inventoryOf } from '@link-loom/react-generators/src/inventory.js';

const MARKER = 'carried over by link-loom migrate: fix the code and remove this line';
const DISABLE_LINE = new RegExp(`^/\\* eslint-disable [^*]* -- ${MARKER} \\*/\\n`);
const LINT_SECTION = '## Lint rules turned off in carried files';
const CHECK_SECTION = '## Check rules waived for carried files';
const LINKS_SECTION = '## Links that lead nowhere';

const binary = (root, name) => {
  const file = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  if (!fs.existsSync(file)) {
    throw new LoomError(ERROR_CODES.notAvailable, `${name} is not installed in ${root}: run npm install first`, {
      next: [`cd ${root}`, 'npm install', 'npx link-loom migrate finish'],
    });
  }

  return file;
};

const run = (root, command, args) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const lint = (root, files, fix) => {
  const outcome = run(root, binary(root, 'eslint'), [...(fix ? ['--fix'] : []), '--format', 'json', ...files]);
  try {
    return JSON.parse(outcome.stdout);
  } catch {
    throw new LoomError(ERROR_CODES.io, 'eslint did not answer in JSON', {
      output: outcome.stderr.split('\n').slice(-20),
    });
  }
};

/** Writes (or rewrites) one section of MIGRATION.md, before its closing `Next:` line. */
const withSection = (report, title, lines) => {
  const section = [title, '', ...lines, ''].join('\n');
  const start = report.indexOf(title);
  if (start === -1) {
    return report.replace(/\nNext: /, `\n${section}\nNext: `);
  }

  const end = report.indexOf('\n## ', start + title.length);
  const tail = end === -1 ? report.slice(report.indexOf('\nNext: ', start)) : report.slice(end);
  return `${report.slice(0, start)}${section}${tail}`;
};

/** The check rules each carried file still fails, as `{ file: [rule ids] }`. */
const checkWaivers = (root, manifest, carried) => {
  const report = runChecks({
    rules: RULES,
    project: createCheckProject({ root, manifest: { ...manifest, migration: { ...manifest.migration, waivers: {} } } }),
  });
  const waivers = {};
  for (const check of report.checks.filter((item) => !item.ok && item.severity === 'error')) {
    for (const problem of check.problems.filter((item) => carried.includes(item.file))) {
      waivers[problem.file] = [...new Set([...(waivers[problem.file] || []), check.id])].sort();
    }
  }

  return waivers;
};

// A route as a pattern: `:id` is one segment, a trailing `*` anything below.
const routePattern = (routePath) => {
  const body = routePath
    .split('/')
    .map((segment) => {
      if (segment === '*') return '.*';
      if (segment.startsWith(':')) return '[^/]+';
      return segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${body.replace(/\/\.\*$/, '(/.*)?')}/?$`);
};

/** App paths written in carried code (strings, or the head of a template) that no route of the project serves. */
const deadLinks = (root, manifest, carried) => {
  const project = createCheckProject({ root, manifest });
  const routes = inventoryOf(project).pages.map((page) => routePattern(page.path));
  const appPath = new RegExp(`^${manifest.basePath}/[a-z0-9][\\w/-]*`);
  const found = [];
  for (const file of carried.filter((item) => /^src\/.*\.jsx?$/.test(item))) {
    walkAst(parseSource(fs.readFileSync(path.join(root, file), 'utf8'), file), (node, parent) => {
      const isHead = node.type === 'TemplateElement' && parent?.quasis?.[0] === node;
      const value = node.type === 'StringLiteral' ? node.value : isHead ? node.value.raw : '';
      const link = appPath.exec(value)?.[0]?.replace(/\/$/, '');
      if (!link) return;
      // A template head ends where its first expression starts: `/admin/item/${id}` is checked as /admin/item/x.
      const candidate = isHead && value.endsWith('/') ? `${link}/x` : link;
      if (!routes.some((route) => route.test(candidate))) found.push({ file, line: node.loc.start.line, link });
    });
  }

  return found;
};

/**
 * The step after `npm install` in a migrated project. Formats the project with its own prettier, applies
 * eslint's fixes, and turns off, per file and per rule, what is left: legacy code was never linted and the new project
 * is. Each line it adds says so, MIGRATION.md lists them and a later run drops the ones already fixed.
 */
export const finishMigration = ({ root }) => {
  const manifestFile = path.join(root, 'loom.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  if (!manifest?.migration) {
    throw new LoomError(ERROR_CODES.validation, 'This folder is not a project built by link-loom migrate apply', {
      missing: ['loom.json migration'],
      problems: [],
    });
  }

  const carried = manifest.migration.carried.filter((file) => fs.existsSync(path.join(root, file)));

  for (const file of carried) {
    const absolute = path.join(root, file);
    const source = fs.readFileSync(absolute, 'utf8');
    if (DISABLE_LINE.test(source)) fs.writeFileSync(absolute, source.replace(DISABLE_LINE, ''));
  }

  // The carried files, and the registries and dictionaries the migration edited, in the project's own format.
  run(root, binary(root, 'prettier'), ['--write', '--log-level', 'warn', 'src', 'tests']);
  const results = lint(root, carried, true);
  const turnedOff = [];
  const broken = [];
  for (const result of results) {
    const file = path.relative(root, result.filePath);
    const errors = result.messages.filter((message) => message.severity === 2);
    if (errors.some((message) => !message.ruleId)) {
      broken.push(`${file}: ${errors.find((message) => !message.ruleId).message}`);
      continue;
    }

    const rules = [...new Set(errors.map((message) => message.ruleId))].sort();
    if (!rules.length) continue;
    const source = fs.readFileSync(result.filePath, 'utf8');
    fs.writeFileSync(result.filePath, `/* eslint-disable ${rules.join(', ')} -- ${MARKER} */\n${source}`);
    turnedOff.push({ file, rules });
  }

  const left = lint(root, carried, false).filter((result) => result.errorCount > 0);
  const waivers = checkWaivers(root, manifest, carried);
  const links = deadLinks(root, manifest, carried);
  fs.writeFileSync(
    manifestFile,
    `${JSON.stringify({ ...manifest, migration: { ...manifest.migration, waivers } }, null, 2)}\n`,
  );

  const reportFile = path.join(root, 'MIGRATION.md');
  if (fs.existsSync(reportFile)) {
    const lintLines = turnedOff.length
      ? turnedOff.map(({ file, rules }) => `- \`${file}\`: ${rules.join(', ')}`)
      : ['- None: every carried file passes lint.'];
    const checkLines = Object.keys(waivers).length
      ? [
          'Listed in `loom.json` (`migration.waivers`); `link-loom check` reports them without failing. Rebuild the piece',
          'with the kit (`add entity`, `OptionsField`…) and drop its line.',
          '',
          ...Object.entries(waivers).map(([file, rules]) => `- \`${file}\`: ${rules.join(', ')}`),
        ]
      : ['- None: every carried file passes `link-loom check`.'];
    let report = fs.readFileSync(reportFile, 'utf8');
    report = withSection(report, LINT_SECTION, [...lintLines, ...broken.map((item) => `- ${item}`)]);
    report = withSection(report, CHECK_SECTION, checkLines);
    report = withSection(
      report,
      LINKS_SECTION,
      links.length
        ? [
            'App paths in carried code that no route serves: map each to its new place in `links` of the decisions',
            '(legacy path → new path) and apply again.',
            '',
            ...links.map(({ file, line, link }) => `- \`${link}\` in \`${file}:${line}\``),
          ]
        : ['- None.'],
    );
    fs.writeFileSync(reportFile, report);
  }

  return {
    carried: carried.length,
    turnedOff,
    waivers,
    deadLinks: links,
    broken,
    clean: !broken.length && !left.length,
  };
};
