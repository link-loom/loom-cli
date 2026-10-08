import { CHECK_SEVERITIES } from '@link-loom/devkit';

export { secretsRule } from '@link-loom/devkit';

const TEXT_FILE = /\.(js|jsx|cjs|mjs|json|html|css|scss|md|txt|yml|yaml)$|(^|\/)\.env\.sample$/;
const ADMINTO = /adminto|coderthemes/i;

export const admintoRule = {
  id: 'no-adminto',
  severity: CHECK_SEVERITIES.error,
  summary: 'Nothing of Adminto or Coderthemes is left: code, assets or licence notes',
  run: (project) =>
    project.targets
      .filter((file) => TEXT_FILE.test(file) && !file.startsWith('tests/'))
      .filter((file) => ADMINTO.test(project.read(file)) || ADMINTO.test(file))
      .map((file) => ({ file, message: 'Mentions Adminto or Coderthemes: rewrite it or delete it' })),
};
