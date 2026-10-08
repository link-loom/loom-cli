import {
  ERROR_CODES,
  LoomError,
  VirtualTree,
  applyTree,
  collectionSkills,
  planSkill,
  stringifyJson,
} from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { getCollection } from '../registry/collections.js';
import { PROJECT_COLLECTIONS, PROJECT_FILE, findProject } from './project.js';

export const SKILL_ACTIONS = Object.freeze(['list', 'install', 'sync']);

const skillsOf = (project) => {
  const collection = getCollection(PROJECT_COLLECTIONS[project.manifest.type]);
  return { collection, skills: collectionSkills(collection.root) };
};

/**
 * `link-loom skills <list|install|sync> [name]`: the agent skills of the project's collection, in .claude/skills and
 * .agent/skills. loom.json records what was installed, so `sync` updates untouched files and reports the ones someone
 * edited by hand as conflicts (`--force` overwrites them). Changing existing files needs `--yes`.
 */
export const runSkills = async ({ action, name, global = {}, cwd }) => {
  if (!SKILL_ACTIONS.includes(action)) {
    throw new LoomError(ERROR_CODES.usage, 'Missing or unknown skills action', { allowed: SKILL_ACTIONS });
  }

  const project = findProject(cwd);
  const { collection, skills } = skillsOf(project);
  const installed = project.manifest.skills || {};

  if (action === 'list') {
    return createResult({
      command: 'skills list',
      project: { root: project.root },
      data: {
        skills: skills.map((skill) => ({
          name: skill.name,
          available: collection.version,
          installed: installed[skill.name]?.version || null,
        })),
      },
    });
  }

  const selected = skills.filter((skill) =>
    name ? skill.name === name : action === 'sync' ? installed[skill.name] : true,
  );
  if (name && !selected.length) {
    throw new LoomError(ERROR_CODES.usage, `Unknown skill: ${name}`, { allowed: skills.map((skill) => skill.name) });
  }

  const tree = new VirtualTree({ root: project.root });
  const records = { ...installed };
  const conflicts = [];
  for (const skill of selected) {
    const planned = planSkill({ tree, skill, version: collection.version, recorded: installed[skill.name]?.files });
    for (const write of [...planned.writes, ...(global.force ? planned.conflicts : [])]) {
      tree.overwrite(write.path, write.content);
    }

    conflicts.push(...(global.force ? [] : planned.conflicts.map((conflict) => conflict.path)));
    records[skill.name] = planned.record;
  }

  tree.overwrite(PROJECT_FILE, stringifyJson({ ...project.manifest, skills: records }));
  const result = {
    command: `skills ${action}`,
    project: { root: project.root },
    plan: tree.plan(),
    data: { skills: selected.map((skill) => skill.name), version: collection.version, conflicts },
    warnings: conflicts.length
      ? [`Edited by hand, left as they are (use --force to replace them): ${conflicts.join(', ')}`]
      : [],
  };

  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  const touchesSkills = result.plan.modify.some((entry) => entry.path !== PROJECT_FILE);
  if (touchesSkills && !global.yes) {
    throw new LoomError(
      ERROR_CODES.confirmationRequired,
      `skills ${action} changes existing files; review the plan and pass --yes`,
      {
        plan: result.plan,
      },
    );
  }

  applyTree(tree);
  return createResult(result);
};
