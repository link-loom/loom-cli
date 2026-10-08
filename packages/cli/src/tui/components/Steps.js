import { Box, Text } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Spinner } from './Spinner.js';

export const STEP_STATES = Object.freeze({ pending: 'pending', active: 'active', done: 'done', failed: 'failed' });

// Done steps carry the brand's colour, as the rest of the TUI; only a failure turns red.
const MARK = Object.freeze({ pending: ['·', COLORS.muted], done: ['✓', COLORS.accent], failed: ['✗', COLORS.error] });

const BAR_WIDTH = 20;

/** A bar of box characters for a share from 0 to 1, and its percentage: ━━━━━━━━──────────── 42% */
export const progressBar = (share) => {
  const bounded = Math.min(1, Math.max(0, share || 0));
  const filled = Math.round(bounded * BAR_WIDTH);
  return {
    filled: '━'.repeat(filled),
    empty: '─'.repeat(BAR_WIDTH - filled),
    percent: `${Math.floor(bounded * 100)}%`,
  };
};

// What the install is doing now, under the bar: the tree being worked out, or the packages in place.
const progressDetail = (progress, phases = {}) =>
  progress.phase === 'installing'
    ? (phases.installing || '{done}/{total}').replace('{done}', progress.done).replace('{total}', progress.total)
    : (phases.resolving || '{found}').replace('{found}', progress.found || 0);

const Progress = ({ progress, strings }) => {
  const detail = progressDetail(progress, strings?.installPhases);
  if (progress.share === null || progress.share === undefined) {
    return html`<${Text} color=${COLORS.muted}>  ${detail}</${Text}>`;
  }

  const bar = progressBar(progress.share);
  return html`
    <${Box} flexDirection="column">
      <${Text}>
        <${Text}>  </${Text}>
        <${Text} color=${COLORS.accent}>${bar.filled}</${Text}>
        <${Text} color=${COLORS.muted}>${bar.empty}</${Text}>
        <${Text} bold> ${bar.percent}</${Text}>
      </${Text}>
      <${Text} color=${COLORS.muted}>  ${detail}</${Text}>
    </${Box}>
  `;
};

export function Steps({ steps, strings, animate = true }) {
  return html`
    <${Box} flexDirection="column">
      ${steps.map((step) => {
        if (step.state === STEP_STATES.active) {
          return html`
            <${Box} key=${step.id} flexDirection="column">
              <${Box}><${Spinner} animate=${animate} /><${Text}> ${step.label}</${Text}></${Box}>
              ${step.progress ? html`<${Progress} progress=${step.progress} strings=${strings} />` : null}
            </${Box}>
          `;
        }

        const [mark, color] = MARK[step.state];
        const label = step.state === STEP_STATES.pending ? COLORS.muted : undefined;
        return html`<${Box} key=${step.id}><${Text} color=${color}>${mark}</${Text}><${Text} color=${label}> ${step.label}</${Text}></${Box}>`;
      })}
    </${Box}>
  `;
}
