import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { ERROR_CODES, LoomError } from '../errors.js';
import { TREE_ACTIONS } from './virtual-tree.js';

const STAGING_FOLDER = '.loom-tmp';

const ensureParent = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

/** Removes the folders a deletion left empty, up to (not including) the root. */
const pruneEmptyParents = (root, filePath) => {
  let directory = path.dirname(filePath);
  while (
    directory.startsWith(root) &&
    directory !== root &&
    fs.existsSync(directory) &&
    !fs.readdirSync(directory).length
  ) {
    fs.rmdirSync(directory);
    directory = path.dirname(directory);
  }
};

/**
 * Commits the tree's changes atomically: every new content is first written to a staging folder,
 * every replaced or deleted file is backed up, and only then are the files moved into place.
 * Any failure restores the backups and removes what was created, including the root if this call created it.
 */
export const applyTree = (tree, { dryRun = false } = {}) => {
  const changes = tree.changes();
  if (dryRun || !changes.length) {
    return { applied: false, plan: tree.plan() };
  }

  const rootExisted = fs.existsSync(tree.root);
  const stagingRoot = path.join(tree.root, STAGING_FOLDER, crypto.randomUUID());
  const stagedDir = path.join(stagingRoot, 'staged');
  const backupDir = path.join(stagingRoot, 'backup');
  const done = [];

  try {
    for (const change of changes) {
      if (change.action === TREE_ACTIONS.delete) {
        continue;
      }

      const stagedPath = path.join(stagedDir, change.path);
      ensureParent(stagedPath);
      fs.writeFileSync(stagedPath, change.content);
    }

    for (const change of changes) {
      const targetPath = path.join(tree.root, change.path);
      const backupPath = path.join(backupDir, change.path);
      const hadOriginal = fs.existsSync(targetPath);

      if (hadOriginal) {
        ensureParent(backupPath);
        fs.renameSync(targetPath, backupPath);
      }

      if (change.action !== TREE_ACTIONS.delete) {
        ensureParent(targetPath);
        fs.renameSync(path.join(stagedDir, change.path), targetPath);
      }

      done.push({ change, targetPath, backupPath, hadOriginal });
    }
  } catch (error) {
    for (const step of done.reverse()) {
      if (step.change.action !== TREE_ACTIONS.delete && fs.existsSync(step.targetPath)) {
        fs.rmSync(step.targetPath, { force: true });
      }

      if (step.hadOriginal && fs.existsSync(step.backupPath)) {
        ensureParent(step.targetPath);
        fs.renameSync(step.backupPath, step.targetPath);
      }
    }

    fs.rmSync(path.join(tree.root, STAGING_FOLDER), { recursive: true, force: true });
    if (!rootExisted) {
      fs.rmSync(tree.root, { recursive: true, force: true });
    }

    throw new LoomError(ERROR_CODES.io, `Could not write the changes: ${error.message}`, { rolledBack: true });
  }

  fs.rmSync(path.join(tree.root, STAGING_FOLDER), { recursive: true, force: true });
  for (const change of changes.filter((candidate) => candidate.action === TREE_ACTIONS.delete)) {
    pruneEmptyParents(path.resolve(tree.root), path.join(path.resolve(tree.root), change.path));
  }

  return { applied: true, plan: tree.plan() };
};
