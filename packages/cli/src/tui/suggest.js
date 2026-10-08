import { answerQuestion } from '../ai/help.js';
import { proposeCommandWithModel } from '../ai/propose.js';
import { PROJECT_TYPES, projectTypeStatus } from '../registry/project-types.js';

// The `add` generator each intent of the local AI stands for.
const INTENT_GENERATORS = Object.freeze({
  add_entity: 'entity',
  add_page: 'page',
  add_component: 'component',
  add_service: 'service',
  add_section: 'section',
  add_blog_post: 'blog-post',
});

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

const projectTypeOf = (args) =>
  PROJECT_TYPES.find(
    (projectType) =>
      projectType.target === args.type &&
      projectTypeStatus(projectType) === 'available' &&
      Object.entries(projectType.defaults).every(([name, value]) => (args[name] ?? value) === value),
  );

const itemOf = ({ strings, proposal, target }) => ({
  key: 'suggestion',
  label: strings.suggested,
  summary:
    proposal.command || fill(strings.suggestionMissing, { command: target, fields: proposal.missing.join(', ') }),
  hint: '',
  disabled: false,
});

/**
 * The list row the local AI proposes for what a person typed: the command it stands for, or the generator with the
 * fields it still needs; for a question, the passage of the documents that answers it. Choosing a command opens that
 * flow with what the request said already filled in; nothing runs before the plan is reviewed. Null when the request
 * is not something this screen can do.
 */
export const suggestionFor = async ({ text, strings, project = null, generators = [], embedder = null }) => {
  const proposal = await proposeCommandWithModel(
    text,
    { domains: project?.domains || [], type: project?.type },
    embedder,
  );
  if (proposal?.help) {
    const [answer] = await answerQuestion(text, { projectRoot: project?.root, embedder, limit: 1 });
    return answer
      ? {
          key: 'answer',
          label: strings.answer,
          summary: `${answer.heading} · ${answer.source}`,
          hint: '',
          disabled: false,
          answer,
        }
      : null;
  }

  if (!proposal) {
    return null;
  }

  if (project) {
    const generator = INTENT_GENERATORS[proposal.intent];
    if (!generator || !generators.some((candidate) => candidate.id === generator)) {
      return null;
    }

    return {
      ...itemOf({ strings, proposal, target: `link-loom add ${generator}` }),
      suggestion: { generator, prefill: proposal.args },
    };
  }

  const projectType = proposal.intent === 'create_project' ? projectTypeOf(proposal.args) : null;
  if (!projectType) {
    return null;
  }

  const { type, ...prefill } = proposal.args;
  return {
    ...itemOf({ strings, proposal, target: `link-loom create ${type}` }),
    suggestion: { projectType, prefill },
  };
};
