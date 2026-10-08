import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ERROR_CODES, LoomError, listFiles, mergeJson, stringifyJson } from '@link-loom/devkit';

import { FILES, readRequired, requireWebapp, within } from '../shared/project.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const STACK = JSON.parse(fs.readFileSync(here('../../stack.json'), 'utf8'));

// What each feature adds to package.json besides its files.
const PACKAGE_CHANGES = Object.freeze({
  images: {
    scripts: {
      'gen:images': 'link-loom images generate',
      'optimize:images': 'link-loom images optimize',
      'og:compose': 'link-loom images og',
    },
  },
});

const NEXT_STEPS = Object.freeze({
  images: [
    'REPLICATE_API_TOKEN=<token> npx link-loom services add image-generation --from-env --yes',
    'npm install',
    'Add slots to images.manifest.json, then npm run gen:images -- <slot>',
  ],
});

/** `add feature <name>`: a capability added after `create`, recorded in loom.json. */
export default async function featureGenerator(tree, options, context = {}) {
  const manifest = context.project;
  requireWebapp(manifest, 'feature');
  if ((manifest.features || []).includes(options.name)) {
    throw new LoomError(ERROR_CODES.targetExists, `This project already has the ${options.name} feature`);
  }

  const files = within(tree, context.directory);
  const sourceDir = here(`./features/${options.name}/`);
  for (const file of listFiles(sourceDir)) {
    files.create(file, fs.readFileSync(`${sourceDir}${file}`));
  }

  const packageJson = JSON.parse(readRequired(files, 'package.json', 'the feature cannot be added'));
  files.overwrite(
    'package.json',
    stringifyJson(mergeJson(packageJson, { ...PACKAGE_CHANGES[options.name], ...STACK.features[options.name] })),
  );
  files.overwrite(
    FILES.manifest,
    stringifyJson({ ...manifest, features: [...(manifest.features || []), options.name] }),
  );
  return { warnings: [], project: { feature: options.name }, next: NEXT_STEPS[options.name] };
}
