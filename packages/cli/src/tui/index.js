import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { render } from 'ink';

import { EXIT_CODES } from '@link-loom/devkit';

import { html } from './html.js';
import { App } from './App.js';
import { detectLocale } from './i18n.js';
import { loadEmbedder } from '../ai/model/embedder.js';
import { CLI_VERSION } from '../version.js';

const MIN_ANIMATED_COLUMNS = 60;

export const shouldAnimate = ({ global = {}, env = process.env, columns = process.stdout.columns || 80 }) =>
  global.animation !== false && !env.NO_COLOR && !env.CI && columns >= MIN_ANIMATED_COLUMNS;

/** The first name of the person, from git (`user.name`), to greet them; null when git does not know it. */
export const personName = ({ env = process.env } = {}) => {
  if (env.LINK_LOOM_NAME !== undefined) return env.LINK_LOOM_NAME.trim() || null;
  const outcome = spawnSync('git', ['config', '--get', 'user.name'], { encoding: 'utf8', timeout: 1000 });
  const name = outcome.status === 0 ? outcome.stdout.trim().split(/\s+/)[0] : '';
  return name || null;
};

// Clears the visible screen and puts the cursor at the top, as Claude Code opens: the TUI draws from the first row
// and leaves its last card where it is when it closes (no alternate screen, whose restore leaves gaps in some
// terminals).
const CLEAR_SCREEN = '\u001B[2J\u001B[H';

/**
 * Opens the interactive TUI and resolves with the exit code (130 if the person pressed Ctrl+C). It takes the terminal
 * from the top (`--no-fullscreen` keeps it under the prompt). `autoRun` runs a command typed with its flags.
 */
export const runTui = async ({
  cwd,
  global = {},
  env = process.env,
  target,
  generator,
  project,
  prefill,
  autoRun = false,
  stdout = process.stdout,
}) => {
  let exitCode = EXIT_CODES.interrupted;
  const locale = detectLocale(env);
  const fullscreen = global.fullscreen !== false && Boolean(stdout.isTTY);
  // Ctrl+C while it works arrives as a signal (npm install runs outside raw mode): the app shows Loomi sad and what
  // was left, then closes, instead of dying half-drawn.
  const interrupts = new EventEmitter();
  const interrupt = () => interrupts.emit('interrupt');
  // The local model reads requests when it is installed and not turned off; a model that fails to load is no model.
  const embedder = global.ai === false || autoRun ? null : await loadEmbedder({ env }).catch(() => null);
  if (fullscreen) {
    stdout.write(CLEAR_SCREEN);
  }

  const app = render(
    html`<${App}
      cwd=${cwd}
      global=${global}
      locale=${locale}
      animate=${shouldAnimate({ global, env })}
      target=${target}
      generator=${generator}
      project=${project}
      prefill=${prefill}
      embedder=${embedder}
      autoRun=${autoRun}
      interrupts=${interrupts}
      person=${personName({ env })}
      version=${CLI_VERSION}
      onExit=${(code) => {
        exitCode = code;
      }}
    />`,
    { stdout, exitOnCtrlC: false, incrementalRendering: true },
  );

  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    await app.waitUntilExit();
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }

  return exitCode;
};
