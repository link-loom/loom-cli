#!/usr/bin/env node
/**
 * Judges what an agent produced for a case: whether it used only the CLI, whether the project is what the brief asked
 * for (loom.json, copy, entities), and whether it passes lint, `link-loom check`, its tests and its build. Writes the
 * report to evals/runs/<date>-<case>.md and exits 0 only when everything passes.
 *
 *   node evals/evaluate.mjs <work folder printed by run.mjs> [--transcript <file.jsonl>]
 *
 * `--transcript` reads the agent's steps from another file (an agent launched some other way, such as a subagent).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(EVALS, '../packages/cli/bin/link-loom.js');

// Tools that write files: the agent must never use them, the CLI writes for it.
const HAND_EDITS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const SHELL_WRITE_COMMANDS = /(^|[;&|]\s*)(sed\s+-i|tee\b|cp\b|mv\b|rm\b|touch\b|mkdir\b)/;

/** Whether a shell command writes a file: a write command, or a redirection to anything but /dev/null. */
/** The folder a command runs in: the last `cd <dir>` before its redirections, or the work folder. */
const commandDir = (command, workDir) => {
  const moves = [...command.matchAll(/(?:^|[;&|]\s*)cd\s+([^\s;&|]+)/g)];
  return moves.length ? path.resolve(workDir, moves.at(-1)[1]) : workDir;
};

/** The shell of a command without what it only passes along: heredoc bodies and quoted strings. */
const shellOf = (command) =>
  command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, '').replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");

// Redirecting output to a log outside the work folder writes no project file; a redirect into it does, unless the
// case lets the agent write that file (`allowWrites`, such as the migrator's decisions).
const writesFiles = (fullCommand, workDir, isAllowed) => {
  const command = shellOf(fullCommand);
  return (
    SHELL_WRITE_COMMANDS.test(command) ||
    [...command.matchAll(/(?:^|[^<&])>{1,2}\s*([^\s|;&]+)/g)].some(([, target]) => {
      if (target === '/dev/null' || target.startsWith('&')) {
        return false;
      }

      const written = path.resolve(commandDir(command, workDir), target);
      return !isAllowed(written) && (written === workDir || written.startsWith(`${workDir}${path.sep}`));
    })
  );
};

const readJsonLines = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

// The project the agent ended with: the folder whose loom.json changed last (trial runs may leave others behind).
const findProject = (directory) => {
  const candidates = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(directory, entry.name))
    .filter((folder) => fs.existsSync(path.join(folder, 'loom.json')))
    .sort(
      (left, right) =>
        fs.statSync(path.join(right, 'loom.json')).mtimeMs - fs.statSync(path.join(left, 'loom.json')).mtimeMs,
    );
  if (candidates.length) {
    return candidates[0];
  }

  return fs.existsSync(path.join(directory, 'loom.json')) ? directory : null;
};

/** What the agent did: every tool call, the CLI commands among them, and what it cost. */
const auditTranscript = (events, workDir, allowWrites = []) => {
  const isAllowed = (file) => allowWrites.some((name) => path.resolve(workDir, file) === path.resolve(workDir, name));
  const calls = events
    .filter((event) => event.type === 'assistant')
    .flatMap((event) => event.message?.content || [])
    .filter((block) => block.type === 'tool_use');
  const commands = calls.filter((call) => call.name === 'Bash').map((call) => call.input?.command || '');
  const result = events.findLast((event) => event.type === 'result') || {};
  const handEdits = [
    ...calls
      .filter((call) => HAND_EDITS.has(call.name) && !isAllowed(call.input?.file_path || ''))
      .map((call) => `${call.name} ${call.input?.file_path || ''}`),
    ...commands.filter((command) => writesFiles(command, workDir, isAllowed)),
  ];
  return {
    toolCalls: calls.length,
    cliCommands: commands.filter((command) => /link-loom/.test(command)),
    handEdits,
    turns: result.num_turns,
    costUsd: result.total_cost_usd,
    tokens: result.usage && {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
      cacheRead: result.usage.cache_read_input_tokens,
    },
    finalMessage: result.result,
  };
};

const valueAt = (object, dottedPath) =>
  dottedPath
    .split('.')
    .reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), object);

const sameSet = (left = [], right = []) => left.length === right.length && left.every((item) => right.includes(item));

/** Each expectation of the case, met or not, with what was found. */
const checkExpectations = (projectDir, expect) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'loom.json'), 'utf8'));
  const results = [];
  for (const [key, wanted] of Object.entries(expect.manifest || {})) {
    const found = valueAt(manifest, key);
    const ok = Array.isArray(wanted)
      ? sameSet(wanted, found)
      : String(found).toLowerCase() === String(wanted).toLowerCase();
    results.push({ check: `loom.json ${key}`, ok, wanted, found });
  }

  for (const [file, fragments] of Object.entries(expect.files || {})) {
    const fullPath = path.join(projectDir, file);
    const text = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
    for (const fragment of fragments) {
      results.push({ check: `${file} has ${fragment}`, ok: text.includes(fragment) });
    }
  }

  for (const wanted of expect.entities || []) {
    const found = (manifest.entities || []).find(
      (entry) => entry.domain === wanted.domain && entry.entity === wanted.entity,
    );
    const ok =
      Boolean(found) &&
      (!wanted.list || found.list === wanted.list) &&
      (wanted.actions || []).every((action) => found.actions.includes(action));
    results.push({ check: `entity ${wanted.domain}/${wanted.entity}`, ok, wanted, found: found || null });
  }

  return results;
};

// What each project type's own `verify` runs, gate by gate.
const GATES = Object.freeze({ webapp: ['lint', 'check', 'test', 'build'], landing: ['check', 'astro check', 'build'] });

const gatesOf = (projectDir) =>
  GATES[JSON.parse(fs.readFileSync(path.join(projectDir, 'loom.json'), 'utf8')).type] || GATES.webapp;

const runGate = (projectDir, gate) => {
  if (gate === 'astro check') {
    const outcome = spawnSync('npm', ['run', 'check'], {
      cwd: projectDir,
      encoding: 'utf8',
      env: { ...process.env, CI: '' },
    });
    return { gate, ok: outcome.status === 0, output: `${outcome.stdout}\n${outcome.stderr}`.slice(-3000) };
  }

  const [command, args] = gate === 'check' ? [process.execPath, [CLI, 'check']] : ['npm', ['run', gate]];
  const outcome = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8', env: { ...process.env, CI: '' } });
  return { gate, ok: outcome.status === 0, output: `${outcome.stdout}\n${outcome.stderr}`.slice(-3000) };
};

const markdown = ({ caseId, workDir, projectDir, audit, expectations, gates, ok }) =>
  [
    `# ${caseId}: ${ok ? 'PASSED' : 'FAILED'}`,
    '',
    `- Work folder: \`${workDir}\``,
    `- Project: \`${projectDir || 'none'}\``,
    `- Tool calls: ${audit.toolCalls}, turns: ${audit.turns ?? '—'}, cost: ${audit.costUsd ?? '—'} USD`,
    `- Tokens: ${audit.tokens ? JSON.stringify(audit.tokens) : '—'}`,
    '',
    '## Only the CLI',
    '',
    audit.handEdits.length ? audit.handEdits.map((edit) => `- ✗ ${edit}`).join('\n') : '- ✓ no hand edits',
    '',
    '### CLI commands',
    '',
    ...audit.cliCommands.map((command) => `- \`${command.replace(/\n/g, ' ')}\``),
    '',
    '## What the brief asked for',
    '',
    ...expectations.map(
      (entry) =>
        `- ${entry.ok ? '✓' : '✗'} ${entry.check}${entry.ok ? '' : ` (wanted ${JSON.stringify(entry.wanted)}, found ${JSON.stringify(entry.found)})`}`,
    ),
    '',
    '## Gates',
    '',
    ...gates.map((gate) => `- ${gate.ok ? '✓' : '✗'} ${gate.gate}`),
    ...gates.filter((gate) => !gate.ok).map((gate) => `\n### ${gate.gate}\n\n\`\`\`\n${gate.output}\n\`\`\``),
    '',
    '## The agent said',
    '',
    audit.finalMessage || '—',
    '',
  ].join('\n');

const main = () => {
  const workDir = path.resolve(process.argv[2] || '');
  // run.mjs leaves the case id in the work folder; a run launched another way names it with --case.
  const caseIndex = process.argv.indexOf('--case');
  const caseId =
    caseIndex === -1 ? fs.readFileSync(path.join(workDir, '.case'), 'utf8').trim() : process.argv[caseIndex + 1];
  const testCase = JSON.parse(fs.readFileSync(path.join(EVALS, 'cases', caseId, 'case.json'), 'utf8'));
  const transcriptIndex = process.argv.indexOf('--transcript');
  const transcript =
    transcriptIndex === -1 ? path.join(workDir, '.transcript.jsonl') : process.argv[transcriptIndex + 1];
  const audit = auditTranscript(readJsonLines(transcript), workDir, testCase.allowWrites);
  const projectDir = findProject(workDir);
  const expectations = projectDir
    ? checkExpectations(projectDir, testCase.expect)
    : [{ check: 'a project with loom.json', ok: false }];
  const gates = projectDir ? gatesOf(projectDir).map((gate) => runGate(projectDir, gate)) : [];
  const ok =
    Boolean(projectDir) &&
    !audit.handEdits.length &&
    expectations.every((entry) => entry.ok) &&
    gates.every((gate) => gate.ok);

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const report = path.join(EVALS, 'runs', `${stamp}-${caseId}.md`);
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, markdown({ caseId, workDir, projectDir, audit, expectations, gates, ok }));
  process.stdout.write(`${report}\n${ok ? 'PASSED' : 'FAILED'}\n`);
  process.exitCode = ok ? 0 : 1;
};

main();
