// How much of a run each step takes: writing is instant, installing is most of the wait. A run's steps are scaled to 100.
const STEP_WEIGHTS = Object.freeze({ render: 2, write: 3, install: 95, finish: 10, verify: 15 });

const STEP_MESSAGES = Object.freeze({
  render: 'Preparing the template',
  write: 'Writing the files',
  install: 'Installing dependencies',
  finish: 'Formatting and linting the carried code',
  verify: 'Checking and building',
});

/** The steps of each command that reports its progress, in order. */
export const PROGRESS_STEPS = Object.freeze({
  create: ['render', 'write', 'install'],
  update: ['write', 'install', 'verify'],
  'migrate apply': ['write', 'install', 'finish'],
});

// While npm works out the tree there is no total yet: report every this many packages found.
const FOUND_EVERY = 25;

const detailOf = (progress) => {
  if (progress?.phase === 'installing') return `${progress.done}/${progress.total} packages in place`;
  if (progress?.phase === 'resolving') return `working out which packages it needs (${progress.found || 0} found)`;
  return '';
};

/**
 * Follows a long command and reports it as progress events, the same for every reader: `{ event: 'progress',
 * command, step, progress, total: 100, message, phase?, done?, packages?, found? }`. `progress` is the whole command
 * from 0 to 100 and only grows; an event goes out when the step changes, the percentage moves, or (before a total is
 * known) every few packages found. `steps` are the steps this run will take, in order.
 */
export const progressReporter = ({ command, steps, emit }) => {
  const weights = steps.map((step) => STEP_WEIGHTS[step] ?? 0);
  const scale = 100 / (weights.reduce((sum, weight) => sum + weight, 0) || 1);
  let last = { step: null, progress: -1, found: 0 };

  const overall = (step, share) => {
    const index = steps.indexOf(step);
    const before = weights.slice(0, Math.max(index, 0)).reduce((sum, weight) => sum + weight, 0);
    return Math.min(100, Math.floor((before + (weights[index] ?? 0) * (share ?? 0)) * scale));
  };

  const report = (step, progress) => {
    const value = Math.max(last.progress, overall(step, progress?.share));
    const found = progress?.found || 0;
    const moved = step !== last.step || value !== last.progress || found - last.found >= FOUND_EVERY;
    if (!moved) return;
    last = { step, progress: value, found: step === last.step ? Math.max(found, last.found) : found };
    const detail = detailOf(progress);
    emit({
      event: 'progress',
      command,
      step,
      progress: value,
      total: 100,
      message: detail ? `${STEP_MESSAGES[step] || step}: ${detail}` : STEP_MESSAGES[step] || step,
      ...(progress?.phase ? { phase: progress.phase } : {}),
      ...(progress?.total ? { done: progress.done, packages: progress.total } : {}),
      ...(progress?.found ? { found: progress.found } : {}),
    });
  };

  return {
    onStep: (step) => report(step, null),
    onProgress: (step, progress) => report(step, progress),
    // The last event: everything done, 100. A run that never started a step (nothing to do) reports nothing.
    done: () => {
      if (last.step === null) return;
      last = { step: 'done', progress: 100, found: 0 };
      emit({ event: 'progress', command, step: 'done', progress: 100, total: 100, message: 'Done' });
    },
  };
};

/** A progress event as one line for a person reading a log: `› 57% Installing dependencies: 512/1203 packages`. */
export const progressLine = (event) => `› ${String(event.progress).padStart(3)}% ${event.message}\n`;
