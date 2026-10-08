#!/usr/bin/env node
/**
 * Hands a case's product brief to a new agent with no context and records what it does.
 *
 *   node evals/run.mjs <case> [--registry http://localhost:4873] [--model <model>]
 *
 * The agent works in an empty folder outside every repository (no CLAUDE.md, no memory, no project rules), with npm
 * pointed at the local registry, and may only run the Link Loom CLI, npm scripts and read files: it cannot write
 * code by hand. Prints the folder; `evaluate.mjs` judges it.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS = path.dirname(fileURLToPath(import.meta.url));

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const ALLOWED_TOOLS = [
  'Bash(npx @link-loom/cli:*)',
  'Bash(npx link-loom:*)',
  'Bash(npm install:*)',
  'Bash(npm run verify:*)',
  'Bash(npm run lint:*)',
  'Bash(npm run build:*)',
  'Bash(npm test:*)',
  'Bash(cd:*)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(pwd)',
  'Read',
  'Glob',
  'Grep',
];

const DISALLOWED_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task'];

const ENVIRONMENT_NOTE = (allowWrites) =>
  [
    'You are in an empty folder. Create the project here.',
    'The Link Loom CLI is available as `npx @link-loom/cli`; npm is already configured, and dependencies install normally.',
    `You can run the CLI, npm scripts and read files. You cannot edit files by hand${
      allowWrites.length ? `, except ${allowWrites.join(', ')} in this folder` : ''
    }.`,
  ].join(' ');

const main = async () => {
  const caseId = process.argv[2];
  const caseDir = path.join(EVALS, 'cases', caseId || '');
  if (!caseId || !fs.existsSync(path.join(caseDir, 'brief.md'))) {
    throw new Error(`Unknown case: ${caseId}. Cases: ${fs.readdirSync(path.join(EVALS, 'cases')).join(', ')}`);
  }

  const registry = argValue('registry', 'http://localhost:4873');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `loom-eval-${caseId}-`));
  const brief = fs.readFileSync(path.join(caseDir, 'brief.md'), 'utf8');
  // A case may let the agent write named files of its own, such as the migrator's decisions; nothing else.
  const { allowWrites = [] } = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
  const writable = allowWrites.flatMap((file) => [`Edit(./${file})`, `Write(./${file})`]);
  const transcript = fs.createWriteStream(path.join(workDir, '.transcript.jsonl'));
  const args = [
    '-p',
    `${brief}\n\n${ENVIRONMENT_NOTE(allowWrites)}`,
    '--output-format',
    'stream-json',
    '--verbose',
    '--no-session-persistence',
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    [...ALLOWED_TOOLS, ...writable].join(' '),
    '--disallowedTools',
    DISALLOWED_TOOLS.filter((tool) => !writable.length || !['Edit', 'Write'].includes(tool)).join(' '),
    ...(argValue('model') ? ['--model', argValue('model')] : []),
  ];

  // npm of its own: the local registry, a clean cache and global prefix, and none of the person's tokens.
  const npmDir = fs.mkdtempSync(path.join(os.tmpdir(), `loom-eval-npm-${caseId}-`));
  const userConfig = path.join(npmDir, 'npmrc');
  fs.writeFileSync(userConfig, `registry=${registry}/\nupdate-notifier=false\nfund=false\naudit=false\n`);

  process.stdout.write(`${workDir}\n`);
  const agent = spawn('claude', args, {
    cwd: workDir,
    env: {
      ...process.env,
      npm_config_userconfig: userConfig,
      npm_config_cache: path.join(npmDir, 'cache'),
      npm_config_prefix: path.join(npmDir, 'global'),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  agent.stdout.pipe(transcript);
  const code = await new Promise((resolve) => agent.on('close', resolve));
  fs.writeFileSync(path.join(workDir, '.case'), caseId);
  process.stdout.write(`agent exited with ${code}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
