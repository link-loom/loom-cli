import { Box, Text, useInput, useWindowSize } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Card } from '../components/Card.js';
import { Logo } from '../components/Logo.js';
import { MASCOT_STATES } from '../components/Mascot.js';
import { fixesFor } from '../fix.js';
import { LOGO_FROM_ROWS } from './Home.js';

const lines = (texts, extra = {}) => texts.map((text) => ({ text, ...extra }));

const shellQuote = (value) => (/^[\w./-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);

/** What to do with a project left halfway: the commands that delete it or finish it, ready to copy. */
export const leftoverCommands = (folder, platform = process.platform) => {
  if (folder === null || folder === undefined) return null;
  const finish = folder ? `cd ${shellQuote(folder)} && npm install` : 'npm install';
  if (!folder) return { finish };
  const remove = platform === 'win32' ? `rmdir /s /q ${shellQuote(folder)}` : `rm -rf ${shellQuote(folder)}`;
  return { remove, finish };
};

/**
 * The end of a run, in the same card as the home: what was made and what comes next, or what went wrong and how to
 * fix it, or (after Ctrl+C) what was left. The command an agent would run goes under the card, whole, to copy it.
 * `interactive` waits for a key; without it, it is the last card, left in the terminal when the app closes.
 */
export function Finished({
  strings,
  animate,
  version,
  title,
  result,
  error,
  stopped = null,
  command,
  onClose = () => {},
  interactive = true,
}) {
  const { rows } = useWindowSize();
  useInput(() => onClose(), { isActive: interactive });
  const logo = (rows || 0) >= LOGO_FROM_ROWS ? html`<${Logo} animate=${false} />` : null;
  const exitHint = interactive ? html`<${Text} color=${COLORS.muted}>${strings.exitHint}</${Text}>` : null;
  const caption = title ? [{ text: title, muted: true }] : [];

  if (error) {
    // What exactly failed: the fields missing or invalid, or the tail of npm's output.
    const details = [
      ...(error.details?.missing?.length ? [`missing: ${error.details.missing.join(', ')}`] : []),
      ...(error.details?.problems || []).map(
        (problem) => `${problem.field ? `${problem.field}: ` : ''}${problem.message}`,
      ),
      ...(error.details?.output || []),
    ];
    const fixes = fixesFor(error, command);
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        ${logo}
        <${Card}
          version=${version}
          heading=${strings.mascot.error}
          state=${MASCOT_STATES.error}
          caption=${caption}
          sections=${[
            {
              title: strings.sections.error,
              lines: [
                { text: `${error.code ? `${error.code}: ` : ''}${error.message}`, color: COLORS.error },
                ...lines(details, { muted: true }),
              ],
            },
            ...(fixes.length ? [{ title: strings.sections.fix, lines: lines(fixes) }] : []),
          ]}
          animate=${animate}
        />
        ${exitHint}
      </${Box}>
    `;
  }

  // Ctrl+C while it worked: Loomi sad, and what was left behind. Before anything ran, nothing was written.
  if (stopped?.whileRunning) {
    const leftover = leftoverCommands(stopped.folder);
    const next = leftover
      ? [
          ...(leftover.remove
            ? [
                { text: strings.stopped.remove, muted: true },
                { text: `  ${leftover.remove}`, color: COLORS.accent },
              ]
            : []),
          { text: strings.stopped.finish, muted: true },
          { text: `  ${leftover.finish}`, color: COLORS.accent },
        ]
      : [{ text: strings.stopped.nothingWritten }];
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        ${logo}
        <${Card}
          version=${version}
          heading=${strings.stopped.heading}
          state=${MASCOT_STATES.error}
          caption=${caption}
          sections=${[
            { title: strings.sections.error, lines: lines([strings.stopped.happened]) },
            { title: strings.sections.next, lines: next },
          ]}
          animate=${animate}
        />
      </${Box}>
    `;
  }

  if (!result) {
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        ${logo}
        <${Card} version=${version} heading=${strings.cancelled} state=${MASCOT_STATES.error} caption=${caption} animate=${animate} />
        ${exitHint}
      </${Box}>
    `;
  }

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      ${logo}
      <${Card}
        version=${version}
        heading=${strings.mascot.success}
        state=${MASCOT_STATES.success}
        caption=${caption}
        sections=${[
          ...(result.warnings.length
            ? [{ title: strings.sections.warnings, color: COLORS.warning, lines: lines(result.warnings) }]
            : []),
          ...(result.next.length ? [{ title: strings.sections.next, lines: lines(result.next) }] : []),
        ]}
        animate=${animate}
      />
      <${Text} color=${COLORS.muted}>${strings.agentCommand}</${Text}>
      <${Text}>  ${command}</${Text}>
      ${interactive ? html`<${Box} marginTop=${1}>${exitHint}</${Box}>` : null}
    </${Box}>
  `;
}
