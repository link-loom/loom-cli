import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { listFiles } from '../template/render.js';

/** Where agents look for skills in a project: Claude Code and the open Agent Skills layout. */
export const SKILL_TARGETS = Object.freeze(['.claude/skills', '.agent/skills']);

export const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

/** The skills a collection ships: one folder per skill under `<root>/skills/`. */
export const collectionSkills = (collectionRoot) => {
  const directory = path.join(collectionRoot, 'skills');
  return fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ name: entry.name, dir: path.join(directory, entry.name) }))
    : [];
};

/** Every file of a skill with its content, relative to the skill folder. */
export const skillFiles = (skillDir) =>
  listFiles(skillDir).map((file) => ({ file, content: fs.readFileSync(path.join(skillDir, file)) }));

/**
 * What installing or syncing a skill writes into a project tree, compared with what loom.json recorded at the last
 * install: files to create, files to update, and conflicts (a file someone edited by hand since then). Answers the
 * new record `{ version, files: { relative path: sha256 } }`.
 */
export const planSkill = ({ tree, skill, version, recorded = {} }) => {
  const files = skillFiles(skill.dir);
  const writes = [];
  const conflicts = [];
  for (const target of SKILL_TARGETS) {
    for (const { file, content } of files) {
      const destination = `${target}/${skill.name}/${file}`;
      const current = tree.read(destination, null);
      if (current === null) {
        writes.push({ path: destination, content });
        continue;
      }

      if (sha256(current) === sha256(content)) {
        continue;
      }

      const handEdited = recorded[file] && sha256(current) !== recorded[file];
      (handEdited || !recorded[file] ? conflicts : writes).push({ path: destination, content });
    }
  }

  return {
    writes,
    conflicts,
    record: { version, files: Object.fromEntries(files.map(({ file, content }) => [file, sha256(content)])) },
  };
};
