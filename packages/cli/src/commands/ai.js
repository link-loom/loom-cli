import { ERROR_CODES, LoomError } from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { answerQuestion } from '../ai/help.js';
import { loadEmbedder } from '../ai/model/embedder.js';
import { installModel, modelStatus, removeModel } from '../ai/model/install.js';
import { findProject } from './project.js';

export const AI_ACTIONS = Object.freeze(['status', 'install', 'remove', 'ask']);

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const projectRootOf = (cwd) => {
  try {
    return findProject(cwd).root;
  } catch {
    return null;
  }
};

/**
 * `link-loom ai <status|install|remove|ask>`: the local model the TUI uses to read requests (a sentence encoder and
 * its WASM runtime, pinned and checked by SHA-256). `install` is the one way it is downloaded; `--offline` refuses
 * it. `ask` answers a question with passages of the project's AGENTS.md, its skills and the CLI's README.
 */
export const runAi = async ({ action, args = [], input = {}, global = {}, cwd, env = process.env, onProgress }) => {
  if (!AI_ACTIONS.includes(action)) {
    throw new LoomError(ERROR_CODES.usage, 'Missing or unknown ai action', { allowed: AI_ACTIONS });
  }

  if (action === 'status') {
    const status = modelStatus(env);
    return {
      result: createResult({ command: 'ai status', data: status }),
      text: status.installed
        ? `local model installed (${megabytes(status.bytes)}) in ${status.dir}`
        : `local model not installed: the CLI reads requests with its rules alone. \`link-loom ai install\` downloads ${megabytes(status.bytesToDownload)} once.`,
    };
  }

  if (action === 'install') {
    if (global.offline || input.offline) {
      throw new LoomError(ERROR_CODES.usage, 'ai install downloads the model; it cannot run with --offline');
    }

    if (global.dryRun) {
      return { result: createResult({ command: 'ai install', dryRun: true, data: modelStatus(env) }) };
    }

    const status = await installModel({ env, onProgress });
    return {
      result: createResult({ command: 'ai install', data: status }),
      text: `local model installed (${megabytes(status.bytes)}) in ${status.dir}`,
    };
  }

  if (action === 'remove') {
    const status = removeModel(env);
    return {
      result: createResult({ command: 'ai remove', data: status }),
      text: `local model removed from ${status.dir}`,
    };
  }

  const question = input.question || args.join(' ');
  if (!question) {
    throw new LoomError(ERROR_CODES.validation, 'ai ask needs a question: link-loom ai ask "how do I add a page?"', {
      missing: ['question'],
      problems: [],
    });
  }

  const embedder = await loadEmbedder({ env });
  const answers = await answerQuestion(question, { projectRoot: projectRootOf(cwd), embedder });
  return {
    result: createResult({ command: 'ai ask', data: { question, model: Boolean(embedder), answers } }),
    text: answers.length
      ? answers.map((answer) => `${answer.source} · ${answer.heading}\n${answer.text}`).join('\n\n---\n\n')
      : 'No passage of the documents answers that.',
  };
};
