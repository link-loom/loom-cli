import { Box, Text, useStdout } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Logo } from '../components/Logo.js';
import { Welcome } from '../components/Welcome.js';
import { SelectList } from '../components/SelectList.js';
import { PROJECT_TYPES, projectTypeStatus } from '../../registry/project-types.js';
import { suggestionFor } from '../suggest.js';

// The woven wordmark joins the welcome only when the terminal has room for both.
export const LOGO_FROM_ROWS = 36;

export function Home({
  strings,
  locale,
  animate,
  person = null,
  version = '',
  cwd = '',
  embedder = null,
  onPick,
  onSuggest = () => {},
  onAnswer = () => {},
  onExit,
}) {
  const items = PROJECT_TYPES.map((projectType) => {
    const available = projectTypeStatus(projectType) === 'available';
    return {
      key: projectType.id,
      label: projectType.label[locale],
      summary: projectType.summary[locale],
      hint: available ? '' : strings.comingSoon,
      disabled: !available,
      projectType,
    };
  });

  const { stdout } = useStdout();
  const sections = [
    { title: strings.welcome.startTitle, lines: strings.welcome.startLines.map((text) => ({ text })) },
    { title: strings.welcome.agentsTitle, lines: [{ text: strings.welcome.agentsLine, muted: true }] },
  ];

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      ${(stdout?.rows || 0) >= LOGO_FROM_ROWS ? html`<${Logo} animate=${animate} />` : null}
      <${Welcome}
        strings=${strings}
        version=${version}
        person=${person}
        cwd=${cwd}
        columns=${stdout?.columns || 80}
        animate=${animate}
        sections=${sections}
      />
      <${Text} bold>${strings.whatToCreate}</${Text}>
      <${Box} marginY=${1}>
        <${SelectList}
          items=${items}
          suggest=${(text) => suggestionFor({ text, strings, embedder })}
          onSelect=${(item) => {
            if (item.answer) return onAnswer(item.answer);
            return item.suggestion ? onSuggest(item.suggestion) : onPick(item.projectType);
          }}
          onCancel=${onExit}
        />
      </${Box}>
      <${Text} color=${COLORS.muted}>${strings.paletteHint}</${Text}>
    </${Box}>
  `;
}
