import { useEffect, useState } from 'react';
import { Box, useWindowSize } from 'ink';

import { html } from '../html.js';
import { Card } from '../components/Card.js';
import { Logo } from '../components/Logo.js';
import { MASCOT_STATES } from '../components/Mascot.js';
import { Steps, STEP_STATES } from '../components/Steps.js';
import { LOGO_FROM_ROWS } from './Home.js';

/**
 * Runs the generator for real and follows its steps (render, write, install), in the same card as the home; the
 * install shows how many packages are already in place, so a slow one is visibly moving.
 */
export function Running({ strings, animate, version, title, stepIds, execute, onDone, onError }) {
  const { rows } = useWindowSize();
  const [steps, setSteps] = useState(
    stepIds.map((id) => ({ id, label: strings.steps[id], state: STEP_STATES.pending })),
  );

  useEffect(() => {
    const onStep = (current) =>
      setSteps((previous) => {
        const reached = previous.findIndex((step) => step.id === current);
        return previous.map((step, index) => ({
          ...step,
          state: index < reached ? STEP_STATES.done : index === reached ? STEP_STATES.active : STEP_STATES.pending,
        }));
      });

    // How far the active step went (npm install: packages in place out of the tree), shown beside it.
    const onProgress = (stepId, progress) =>
      setSteps((previous) => previous.map((step) => (step.id === stepId ? { ...step, progress } : step)));

    execute(onStep, onProgress)
      .then((result) => {
        setSteps((previous) => previous.map((step) => ({ ...step, state: STEP_STATES.done })));
        onDone(result);
      })
      .catch((error) => {
        setSteps((previous) =>
          previous.map((step) => (step.state === STEP_STATES.active ? { ...step, state: STEP_STATES.failed } : step)),
        );
        onError(error);
      });
  }, []);

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      ${(rows || 0) >= LOGO_FROM_ROWS ? html`<${Logo} animate=${false} />` : null}
      <${Card}
        version=${version}
        heading=${strings.mascot.working}
        state=${MASCOT_STATES.working}
        caption=${title ? [{ text: title, muted: true }] : []}
        sections=${[
          {
            title: strings.sections.progress,
            content: html`<${Steps} steps=${steps} strings=${strings} animate=${animate} />`,
          },
        ]}
        animate=${animate}
      />
    </${Box}>
  `;
}
