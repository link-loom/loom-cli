import fs from 'node:fs';
import path from 'node:path';

import { ERROR_CODES, LoomError } from '../errors.js';
import { normalizeTreePath } from './paths.js';

const ACTIONS = Object.freeze({ create: 'create', modify: 'modify', delete: 'delete' });

const toBuffer = (content) => (Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8'));

/**
 * Records file changes in memory against a real root directory. Nothing touches the disk until
 * `applyTree` commits the changes, so a generator can be planned (dry run) and applied with the same code.
 */
export class VirtualTree {
  #root;
  #changes = new Map();

  constructor({ root }) {
    this.#root = path.resolve(root);
  }

  get root() {
    return this.#root;
  }

  #diskPath(treePath) {
    return path.join(this.#root, treePath);
  }

  #existsOnDisk(treePath) {
    return fs.existsSync(this.#diskPath(treePath));
  }

  exists(filePath) {
    const treePath = normalizeTreePath(filePath);
    const change = this.#changes.get(treePath);
    if (change) {
      return change.action !== ACTIONS.delete;
    }

    return this.#existsOnDisk(treePath);
  }

  read(filePath, encoding = 'utf8') {
    const treePath = normalizeTreePath(filePath);
    const change = this.#changes.get(treePath);
    if (change?.action === ACTIONS.delete) {
      return null;
    }

    if (change) {
      return encoding ? change.content.toString(encoding) : change.content;
    }

    if (!this.#existsOnDisk(treePath)) {
      return null;
    }

    return fs.readFileSync(this.#diskPath(treePath), encoding || undefined);
  }

  create(filePath, content) {
    const treePath = normalizeTreePath(filePath);
    if (this.exists(treePath)) {
      throw new LoomError(ERROR_CODES.targetExists, `File already exists: ${treePath}`, { path: treePath });
    }

    // A file deleted in this tree and written again replaces the one on disk.
    const action = this.#existsOnDisk(treePath) ? ACTIONS.modify : ACTIONS.create;
    this.#changes.set(treePath, { action, content: toBuffer(content) });
  }

  overwrite(filePath, content) {
    const treePath = normalizeTreePath(filePath);
    const action = this.#existsOnDisk(treePath) ? ACTIONS.modify : ACTIONS.create;
    this.#changes.set(treePath, { action, content: toBuffer(content) });
  }

  delete(filePath) {
    const treePath = normalizeTreePath(filePath);
    if (!this.#existsOnDisk(treePath)) {
      this.#changes.delete(treePath);
      return;
    }

    this.#changes.set(treePath, { action: ACTIONS.delete, content: null });
  }

  changes() {
    return [...this.#changes.entries()]
      .map(([treePath, change]) => ({ path: treePath, action: change.action, content: change.content }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  plan() {
    const plan = { create: [], modify: [], delete: [] };
    for (const change of this.changes()) {
      if (change.action === ACTIONS.delete) {
        plan.delete.push({ path: change.path });
        continue;
      }

      plan[change.action].push({ path: change.path, bytes: change.content.length });
    }

    return plan;
  }
}

export { ACTIONS as TREE_ACTIONS };
