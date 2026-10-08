export const MODES = Object.freeze({ agent: 'agent', human: 'human' });

/**
 * Agent mode never prompts: it is the default without a TTY, and also with --json, CI or LINK_LOOM_MODE=agent.
 * Human mode can open the TUI.
 */
export const resolveMode = ({
  global = {},
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) => {
  if (global.json || env.LINK_LOOM_MODE === 'agent' || env.CI) {
    return MODES.agent;
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    return MODES.agent;
  }

  return MODES.human;
};
