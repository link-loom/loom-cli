import { Box, Text, useStdout } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Logo } from '../components/Logo.js';
import { Welcome } from '../components/Welcome.js';
import { LOGO_FROM_ROWS } from './Home.js';
import { SelectList } from '../components/SelectList.js';
import { suggestionFor } from '../suggest.js';

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

/** The home inside a project: what it is and what can be added to it, one generator per row. */
export function ProjectHome({
  strings,
  animate,
  person = null,
  version = '',
  cwd = '',
  project,
  generators,
  embedder = null,
  onPick,
  onSuggest = () => {},
  onAnswer = () => {},
  onExit,
}) {
  const items = generators.map((generator) => ({
    key: generator.id,
    label: `add ${generator.id}`,
    summary: generator.description,
    hint: '',
    disabled: false,
    generator,
  }));

  const { stdout } = useStdout();
  const sections = [
    {
      title: strings.welcome.projectTitle,
      lines: [
        {
          text: fill(strings.projectLine, {
            name: project.name || project.slug || project.root,
            type: [project.type, project.variant].filter(Boolean).join(' '),
            layers: (project.layers || []).join(', '),
          }),
        },
        {
          text: fill(strings.projectCounts, {
            entities: (project.entities || []).length,
            pages: (project.pages || []).length,
          }),
          muted: true,
        },
      ],
    },
    { title: strings.welcome.startTitle, lines: [{ text: strings.welcome.addLine }] },
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
      <${Text} bold>${strings.whatToAdd}</${Text}>
      <${Box} marginY=${1}>
        <${SelectList}
          items=${items}
          suggest=${(text) => suggestionFor({ text, strings, project, generators, embedder })}
          onSelect=${(item) => {
            if (item.answer) return onAnswer(item.answer);
            return item.suggestion ? onSuggest(item.suggestion) : onPick(item.generator);
          }}
          onCancel=${onExit}
        />
      </${Box}>
      <${Text} color=${COLORS.muted}>${strings.paletteHint}</${Text}>
    </${Box}>
  `;
}
