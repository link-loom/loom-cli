import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  ERROR_CODES,
  IMAGE_MANIFEST_FILE,
  LoomError,
  VirtualTree,
  applyTree,
  generateImages,
  ogSvg,
  OG_WIDTH,
  optimizeImages,
  parseImageManifest,
  readDotenv,
  resolveImageProvider,
  selectSlots,
  svgToJpeg,
} from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { findProject } from './project.js';

export const IMAGE_ACTIONS = Object.freeze(['generate', 'optimize', 'og']);

const slugOf = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readManifest = (root) => {
  const file = path.join(root, IMAGE_MANIFEST_FILE);
  if (!fs.existsSync(file)) {
    throw new LoomError(ERROR_CODES.usage, `This project has no ${IMAGE_MANIFEST_FILE}`, {
      next: ['link-loom add feature images'],
    });
  }

  return parseImageManifest(fs.readFileSync(file, 'utf8'));
};

/** The process environment, then the project's .env.local for whatever the process does not set. */
const projectEnv = (root, env) => {
  const localFile = path.join(root, '.env.local');
  const local = fs.existsSync(localFile) ? readDotenv(fs.readFileSync(localFile, 'utf8')) : {};
  return { ...local, ...env };
};

const loadSharp = (root) => {
  try {
    return createRequire(path.join(root, 'package.json'))('sharp');
  } catch {
    throw new LoomError(ERROR_CODES.usage, '`images optimize` needs sharp in the project', {
      next: ['npm install --save-dev sharp'],
    });
  }
};

const runGenerate = async ({ project, slotNames, global, env, onProgress }) => {
  const manifest = readManifest(project.root);
  const slots = selectSlots(manifest, slotNames);
  const provider = resolveImageProvider({ env: projectEnv(project.root, env) });
  const planned = { provider: provider.name, model: provider.model, slots: slots.map((entry) => entry.slot) };
  if (global.dryRun) {
    return createResult({ command: 'images generate', dryRun: true, project: { root: project.root }, data: planned });
  }

  const results = await generateImages({ root: project.root, manifest, slots, provider, onProgress });
  const failed = results.filter((result) => !result.ok);
  if (failed.length === results.length) {
    throw new LoomError(ERROR_CODES.fetch, 'No image could be generated', { results });
  }

  return createResult({
    command: 'images generate',
    project: { root: project.root },
    data: { ...planned, results },
    warnings: failed.map((result) => `${result.slot}: ${result.error}`),
    next: ['link-loom images optimize'],
  });
};

const runOptimize = async ({ project, only, input, global }) => {
  const manifest = readManifest(project.root);
  const sharp = global.dryRun ? null : loadSharp(project.root);
  const results = await optimizeImages({
    root: project.root,
    manifest,
    sharp,
    force: Boolean(input.force),
    only,
    dryRun: global.dryRun,
  });
  return createResult({
    command: 'images optimize',
    dryRun: Boolean(global.dryRun),
    project: { root: project.root },
    data: { results },
  });
};

/** A page's share image in the project's brand: its title over the header colour, with the site's monogram. */
const runOg = async ({ project, args = [], input, global }) => {
  const colors = project.manifest.brand?.colors;
  if (!colors) {
    throw new LoomError(ERROR_CODES.usage, 'This project has no brand in loom.json', {
      next: ['link-loom brand colors'],
    });
  }

  // `npm run og:compose -- "Pricing"` passes the title as a word; --title says the same.
  const title = input.title || args.join(' ');
  if (!title) {
    throw new LoomError(ERROR_CODES.validation, 'images og needs a title: --title "Pricing" or `images og Pricing`', {
      missing: ['title'],
      problems: [],
    });
  }

  const file = input.out || `public/brand/og-${slugOf(title)}.jpg`;
  const tree = new VirtualTree({ root: project.root });
  tree.overwrite(
    file,
    svgToJpeg(
      ogSvg({ name: title, tagline: input.tagline || '', brand: colors, markName: project.manifest.name }),
      OG_WIDTH,
    ),
  );
  const result = { command: 'images og', project: { root: project.root }, plan: tree.plan(), data: { file } };

  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  if (result.plan.modify.length && !global.yes) {
    throw new LoomError(ERROR_CODES.confirmationRequired, `${file} exists; pass --yes to replace it`, {
      plan: result.plan,
    });
  }

  applyTree(tree);
  return createResult(result);
};

/**
 * `link-loom images <generate|optimize|og>` in any frontend project: generate PNG masters from the manifest's prompts
 * (at most five slots per run), turn them into WebP, or compose a page's share image in the brand.
 */
export const runImages = async ({ action, args = [], input = {}, global = {}, cwd, env = process.env, onProgress }) => {
  if (!IMAGE_ACTIONS.includes(action)) {
    throw new LoomError(ERROR_CODES.usage, 'Missing or unknown images action', { allowed: IMAGE_ACTIONS });
  }

  const project = findProject(cwd);
  if (action === 'generate') {
    return runGenerate({ project, slotNames: args, global, env, onProgress });
  }

  if (action === 'optimize') {
    return runOptimize({ project, only: args, input, global });
  }

  return runOg({ project, args, input, global });
};
