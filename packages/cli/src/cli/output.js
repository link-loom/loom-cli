import { isLoomError } from '@link-loom/devkit';

export const RESULT_SCHEMA_VERSION = 1;

export const createResult = ({
  command,
  dryRun = false,
  project = null,
  input = null,
  plan = null,
  warnings = [],
  next = [],
  data,
} = {}) => ({
  schemaVersion: RESULT_SCHEMA_VERSION,
  ok: true,
  command,
  dryRun,
  project,
  input,
  plan,
  warnings,
  errors: [],
  next,
  ...(data === undefined ? {} : { data }),
});

export const createErrorResult = ({ command, error, input = null, plan = null, dryRun = false }) => ({
  schemaVersion: RESULT_SCHEMA_VERSION,
  ok: false,
  command,
  dryRun,
  project: null,
  input,
  plan,
  warnings: [],
  errors: [isLoomError(error) ? error.toJSON() : { code: 'E_INTERNAL', message: error.message }],
  next: [],
});

const PLAN_MARKERS = [
  ['create', '+'],
  ['modify', '~'],
  ['delete', '-'],
];

const planLines = (plan) =>
  PLAN_MARKERS.filter(([action]) => plan?.[action]?.length).map(
    ([action, marker]) => `  ${marker} ${plan[action].length} ${action}`,
  );

const resultLines = (result) => {
  if (!result.ok) {
    // An error says what is wrong, then each problem (which field, which file) and what to do next.
    return result.errors.flatMap((error) => [
      `error ${error.code}: ${error.message}`,
      ...(error.missing || []).map((field) => `  missing: ${field}`),
      ...(error.problems || []).map((problem) => `  ${problem.field ? `${problem.field}: ` : ''}${problem.message}`),
      // A change that needs --yes shows what it would do, and the files it would change.
      ...(error.plan ? planLines(error.plan) : []),
      ...(error.plan?.modify || []).map((entry) => `      ~ ${entry.path}`),
      ...(error.plan?.delete || []).map((entry) => `      - ${entry.path}`),
      ...(error.next || []).map((step) => `  next: ${step}`),
    ]);
  }

  return [
    `${result.command}${result.dryRun ? ' (dry run)' : ''}`,
    ...planLines(result.plan),
    ...result.warnings.map((warning) => `warning: ${warning}`),
    ...(result.next.length ? ['next:', ...result.next.map((step) => `  ${step}`)] : []),
  ];
};

/** In JSON mode stdout carries exactly one document; everything else goes to stderr. */
export const writeResult = (result, { json, stdout, stderr }) => {
  if (json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  (result.ok ? stdout : stderr).write(`${resultLines(result).join('\n')}\n`);
};
