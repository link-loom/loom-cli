import os from 'node:os';

import { useEffect, useRef, useState } from 'react';
import { useApp, useInput } from 'ink';

import { EXIT_CODES } from '@link-loom/devkit';

import { html } from './html.js';
import { getStrings } from './i18n.js';
import { agentCommand } from './agent-command.js';
import { Home } from './screens/Home.js';
import { ProjectHome } from './screens/ProjectHome.js';
import { Wizard, pendingFields } from './screens/Wizard.js';
import { Review } from './screens/Review.js';
import { Running } from './screens/Running.js';
import { Finished } from './screens/Finished.js';
import { Answer } from './screens/Answer.js';
import { CREATE_STEPS, createSchema, runCreate } from '../commands/create.js';
import { projectSchema, runProjectGenerator } from '../commands/project.js';
import { PROJECT_TYPES } from '../registry/project-types.js';

const SCREENS = Object.freeze({
  home: 'home',
  answer: 'answer',
  wizard: 'wizard',
  review: 'review',
  running: 'running',
  finished: 'finished',
});

const ADD_STEPS = Object.freeze([CREATE_STEPS.write]);

const projectTypeFor = (target, prefill) =>
  PROJECT_TYPES.find(
    (projectType) =>
      projectType.target === target &&
      Object.entries(projectType.defaults).every(
        ([name, value]) => prefill[name] === undefined || prefill[name] === value,
      ),
  );

/**
 * What the TUI is about to do, the same way for both kinds: `create <type>` from the home, or `add <generator>`
 * inside a project. Each one knows its schema, how to preview its plan and how to apply it.
 */
const createOperation = (projectType) => ({
  command: projectType.target,
  defaults: projectType.defaults,
  schema: createSchema(projectType.target),
  preview: ({ values, global, cwd }) =>
    runCreate({ target: projectType.target, input: values, global: { ...global, dryRun: true }, cwd }),
  execute: ({ values, global, cwd, onStep, onProgress }) =>
    runCreate({
      target: projectType.target,
      input: values,
      global: { ...global, dryRun: false },
      cwd,
      onStep,
      onProgress,
    }),
  stepIds: (global) =>
    global.install === false ? [CREATE_STEPS.render, CREATE_STEPS.write] : Object.values(CREATE_STEPS),
});

// The person confirmed the plan in Review, which is what --yes stands for.
const addOperation = (cwd, generatorId) => {
  const run = ({ values, global, dryRun }) =>
    runProjectGenerator({
      command: `add ${generatorId}`,
      generatorId,
      input: values,
      global: { ...global, dryRun, yes: !dryRun },
      cwd,
    });
  return {
    command: `add ${generatorId}`,
    defaults: {},
    schema: projectSchema(cwd, generatorId),
    preview: ({ values, global }) => run({ values, global, dryRun: true }),
    execute: ({ values, global }) => run({ values, global, dryRun: false }),
    stepIds: () => ADD_STEPS,
  };
};

const initialOperation = ({ cwd, target, generator, prefill }) => {
  if (generator) {
    return addOperation(cwd, generator);
  }

  if (!target) {
    return null;
  }

  // A command typed with flags names its type; the home's presets only add their defaults.
  return createOperation(projectTypeFor(target, prefill) || { target, defaults: {} });
};

// The working folder as people read it: the home folder as ~.
const displayPath = (folder = '') => {
  const home = os.homedir();
  return folder && folder.startsWith(home) ? `~${folder.slice(home.length)}` : folder;
};

/**
 * The TUI. `autoRun` is a command typed with every flag it needs: it goes straight to work, with Loomi in its hard
 * hat, and closes on its last card. Ctrl+C (a key in the menus, a signal from `interrupts` while npm installs) closes
 * on Loomi sad and what was left. The last card stays in the terminal.
 */
export function App(props) {
  return html`<${Screens} ...${props} />`;
}

function Screens({
  cwd,
  global,
  locale,
  animate,
  target,
  generator,
  project = null,
  prefill = {},
  embedder = null,
  person = null,
  version = '',
  autoRun = false,
  interrupts = null,
  onExit,
}) {
  const { exit } = useApp();
  const strings = getStrings(locale);
  const [operation, setOperation] = useState(() => initialOperation({ cwd, target, generator, prefill }));
  const [values, setValues] = useState(() => (operation ? { ...operation.defaults, ...prefill } : {}));
  const [screen, setScreen] = useState(() => {
    if (!operation) {
      return SCREENS.home;
    }

    // A typed command runs with the defaults of whatever it left out; only a required field it lacks stops it.
    const missing = (operation.schema.required || []).filter(
      (name) => values[name] === undefined || values[name] === '',
    );
    if (autoRun && !missing.length) {
      return SCREENS.running;
    }

    return pendingFields(operation.schema, values).length ? SCREENS.wizard : SCREENS.review;
  });
  const [outcome, setOutcome] = useState({ result: null, error: null, stopped: null });
  // The last card is drawn once more without its key hint, then the app closes and leaves it in the terminal.
  const [closing, setClosing] = useState(false);
  const stopped = useRef(false);
  // The folder a create writes into, once it is known: a run stopped halfway says how to delete or finish it.
  const [folder, setFolder] = useState(null);
  const [answer, setAnswer] = useState(null);

  const showAnswer = (found) => {
    setAnswer(found);
    setScreen(SCREENS.answer);
  };

  const close = (code) => {
    onExit(code);
    exit();
  };

  const commandLine = () => (operation ? agentCommand(operation.command, values, operation.schema) : '');
  // What is being made, as the caption under Loomi: `link-loom create webapp · Acme Admin`.
  const runTitle = () =>
    operation
      ? `link-loom ${operation.command.includes(' ') ? operation.command : `create ${operation.command}`}${values.name ? ` · ${values.name}` : ''}`
      : '';

  const finish = (result, error) => {
    if (stopped.current) {
      return;
    }

    setOutcome({ result, error, stopped: null });
    setScreen(SCREENS.finished);
    // A typed command closes as soon as it is done, on its last card.
    if (autoRun && (result || error)) {
      setClosing(true);
    }
  };

  const stop = () => {
    if (stopped.current) {
      return;
    }

    stopped.current = true;
    setOutcome({ result: null, error: null, stopped: { whileRunning: screen === SCREENS.running, folder } });
    setScreen(SCREENS.finished);
    setClosing(true);
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        stop();
      }
    },
    { isActive: screen !== SCREENS.running && !closing },
  );

  useEffect(() => {
    if (!interrupts) {
      return undefined;
    }

    interrupts.on('interrupt', stop);
    return () => interrupts.off('interrupt', stop);
  });

  useEffect(() => {
    if (!closing) {
      return undefined;
    }

    const code = outcome.stopped
      ? EXIT_CODES.interrupted
      : outcome.error
        ? outcome.error.exitCode || EXIT_CODES.failure
        : EXIT_CODES.ok;
    // Give the last card a frame to reach the terminal before closing on it.
    const timer = setTimeout(() => close(code), 60);
    return () => clearTimeout(timer);
  }, [closing]);

  // A proposal of the local AI fills the fields it read; anything the schema does not take is left out.
  const start = (next, prefill = {}) => {
    const known = Object.entries(prefill).filter(
      ([name, value]) => value !== undefined && value !== '' && next.schema.properties?.[name],
    );
    const knownValues = { ...next.defaults, ...Object.fromEntries(known) };
    setOperation(next);
    setValues(knownValues);
    setScreen(pendingFields(next.schema, knownValues).length ? SCREENS.wizard : SCREENS.review);
  };

  if (screen === SCREENS.answer) {
    return html`<${Answer} strings=${strings} answer=${answer} onBack=${() => setScreen(SCREENS.home)} />`;
  }

  if (screen === SCREENS.home && project) {
    return html`<${ProjectHome}
      strings=${strings}
      animate=${animate}
      person=${person}
      version=${version}
      cwd=${displayPath(cwd)}
      project=${project}
      generators=${project.generators || []}
      embedder=${embedder}
      onAnswer=${showAnswer}
      onPick=${(picked) => start(addOperation(cwd, picked.id))}
      onSuggest=${({ generator: id, prefill }) => start(addOperation(cwd, id), prefill)}
      onExit=${() => close(EXIT_CODES.ok)}
    />`;
  }

  if (screen === SCREENS.home) {
    return html`<${Home}
      strings=${strings}
      locale=${locale}
      animate=${animate}
      person=${person}
      version=${version}
      cwd=${displayPath(cwd)}
      embedder=${embedder}
      onAnswer=${showAnswer}
      onPick=${(type) => start(createOperation(type))}
      onSuggest=${({ projectType, prefill }) => start(createOperation(projectType), prefill)}
      onExit=${() => close(EXIT_CODES.ok)}
    />`;
  }

  if (screen === SCREENS.wizard) {
    return html`<${Wizard}
      schema=${operation.schema}
      initialValues=${values}
      strings=${strings}
      locale=${locale}
      onDone=${(answered) => {
        setValues(answered);
        setScreen(SCREENS.review);
      }}
      onCancel=${() => setScreen(SCREENS.home)}
    />`;
  }

  if (screen === SCREENS.review) {
    return html`<${Review}
      command=${agentCommand(operation.command, values, operation.schema)}
      strings=${strings}
      animate=${animate}
      preview=${() => operation.preview({ values, global, cwd })}
      onConfirm=${() => setScreen(SCREENS.running)}
      onCancel=${() => finish(null, null)}
      onError=${(error) => finish(null, error)}
    />`;
  }

  if (screen === SCREENS.running) {
    return html`<${Running}
      strings=${strings}
      animate=${animate}
      version=${version}
      title=${runTitle()}
      stepIds=${operation.stepIds(global)}
      execute=${(onStep, onProgress) =>
        operation.execute({
          values,
          global,
          cwd,
          onStep: (step, detail) => {
            if (detail?.folder !== undefined) setFolder(detail.folder);
            onStep(step);
          },
          onProgress,
        })}
      onDone=${(result) => finish(result, null)}
      onError=${(error) => finish(null, error)}
    />`;
  }

  return html`<${Finished}
    strings=${strings}
    animate=${animate && !closing}
    version=${version}
    title=${runTitle()}
    result=${outcome.result}
    error=${outcome.error}
    stopped=${outcome.stopped}
    command=${commandLine()}
    interactive=${!closing}
    onClose=${() => setClosing(true)}
  />`;
}
