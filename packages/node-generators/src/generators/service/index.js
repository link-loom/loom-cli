import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ERROR_CODES, LoomError, fetchGithubTarball, listFiles } from '@link-loom/devkit';

const TEMPLATE_REPO = 'link-loom/loom-svc-js';
const PLACEHOLDER = '%LOOM%';

// The only places loom-svc-js marks with the placeholder today. A different count means the template moved
// and the result must be reviewed, so it is reported instead of silently replacing elsewhere.
const EXPECTED_PLACEHOLDERS = Object.freeze({
  'package.json': 1,
  'config/template.json': 1,
  'src/services/notification/notification-management/notification-management.service.js': 1,
});

const IGNORED = new Set(['.git']);

const isText = (buffer) => !buffer.includes(0);

const countOccurrences = (text) => text.split(PLACEHOLDER).length - 1;

const resolveTemplate = async (context, ref) => {
  if (context.templateDir) {
    return { dir: context.templateDir, cleanup: () => {} };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-svc-js-'));
  await fetchGithubTarball({ repo: TEMPLATE_REPO, ref, destination: dir });
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
};

export default async function serviceGenerator(tree, options, context = {}) {
  const directory = options.directory || options.name;
  if (tree.exists(directory)) {
    throw new LoomError(ERROR_CODES.targetExists, `The target folder already exists: ${directory}`, {
      path: directory,
    });
  }

  const template = await resolveTemplate(context, options.ref);
  const found = {};
  try {
    for (const relativePath of listFiles(template.dir)) {
      if (IGNORED.has(relativePath.split('/')[0])) {
        continue;
      }

      const content = fs.readFileSync(path.join(template.dir, relativePath));
      if (!isText(content)) {
        tree.create(`${directory}/${relativePath}`, content);
        continue;
      }

      const text = content.toString('utf8');
      const occurrences = countOccurrences(text);
      if (occurrences) {
        found[relativePath] = occurrences;
      }

      tree.create(`${directory}/${relativePath}`, occurrences ? text.split(PLACEHOLDER).join(options.name) : text);
    }
  } finally {
    template.cleanup();
  }

  const drift = Object.keys({ ...EXPECTED_PLACEHOLDERS, ...found }).filter(
    (file) => (found[file] || 0) !== (EXPECTED_PLACEHOLDERS[file] || 0),
  );

  const warnings = [];
  if (options.shape === 'microservice') {
    warnings.push(
      'monolith and microservice share the loom-svc-js template until node-generators ships its own layers',
    );
  }

  if (drift.length) {
    warnings.push(`loom-svc-js placeholders moved; review: ${drift.join(', ')}`);
  }

  return {
    warnings,
    project: { directory, kind: 'service', shape: options.shape, template: `${TEMPLATE_REPO}@${options.ref}` },
    next: [`cd ${directory}`, 'cp config/template.json config/default.json', 'npm start'],
    installIn: directory,
  };
}
