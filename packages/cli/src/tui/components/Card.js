import { Box, Text, useWindowSize } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Loomi } from './Mascot.js';

const MAX_WIDTH = 96;
// Below this many columns the right side goes under Loomi instead of beside it.
const TWO_COLUMNS_FROM = 76;

/** The top border with the title set in it: ╭─── Link Loom v3 ──────╮ */
export const titledBorder = (title, width) => {
  const lead = '╭─── ';
  const fill = Math.max(0, width - lead.length - title.length - 2);
  return { lead, title, tail: ` ${'─'.repeat(fill)}╮` };
};

const Section = ({ section, first }) => html`
  <${Box} flexDirection="column" marginTop=${first ? 0 : 1}>
    <${Text} bold color=${section.color || COLORS.accent}>${section.title}</${Text}>
    ${
      section.content ||
      section.lines.map(
        (line, index) =>
          html`<${Text} key=${index} color=${line.color || (line.muted ? COLORS.muted : undefined)}>${line.text}</${Text}>`,
      )
    }
  </${Box}>
`;

/**
 * The card every screen of the TUI is drawn in, as Claude Code greets: a rounded frame with the name and version in
 * its border, Loomi with a heading and a caption on the left, and on the right what matters now (tips, steps, what
 * comes next). In a narrow terminal the right side goes under Loomi, or away when it is only tips.
 */
export function Card({
  version,
  heading,
  state,
  caption = [],
  sections: given = [],
  animate = true,
  columns: forcedColumns,
  hideSectionsWhenNarrow = false,
}) {
  const { columns } = useWindowSize();
  const width = Math.min(MAX_WIDTH, Math.max(40, (forcedColumns ?? columns ?? 80) - 2));
  const twoColumns = width >= TWO_COLUMNS_FROM;
  const sections = !twoColumns && hideSectionsWhenNarrow ? [] : given;
  const border = titledBorder(`Link Loom${version ? ` v${version}` : ''}`, width);
  const right = sections.map(
    (section, index) => html`<${Section} key=${section.title} section=${section} first=${index === 0} />`,
  );

  return html`
    <${Box} flexDirection="column" width=${width} marginBottom=${1}>
      <${Text}>
        <${Text} color=${COLORS.accent}>${border.lead}</${Text}>
        <${Text} bold>${border.title}</${Text}>
        <${Text} color=${COLORS.accent}>${border.tail}</${Text}>
      </${Text}>
      <${Box}
        borderStyle="round"
        borderTop=${false}
        borderColor=${COLORS.accent}
        paddingX=${1}
        flexDirection=${twoColumns ? 'row' : 'column'}
      >
        <${Box} flexDirection="column" alignItems="center" width=${twoColumns && sections.length ? '45%' : '100%'} paddingY=${1}>
          <${Text} bold>${heading}</${Text}>
          <${Box} marginY=${1}><${Loomi} state=${state} animate=${animate} /></${Box}>
          ${caption.map(
            (line, index) =>
              html`<${Text} key=${index} color=${line.muted ? COLORS.muted : undefined} wrap=${line.truncate ? 'truncate-start' : 'wrap'}>${line.text}</${Text}>`,
          )}
        </${Box}>
        ${
          sections.length && twoColumns
            ? html`
              <${Box}
                flexDirection="column"
                flexGrow=${1}
                borderStyle="single"
                borderTop=${false}
                borderRight=${false}
                borderBottom=${false}
                borderColor=${COLORS.muted}
                paddingLeft=${2}
                paddingY=${1}
              >
                ${right}
              </${Box}>
            `
            : null
        }
        ${sections.length && !twoColumns ? html`<${Box} flexDirection="column" paddingBottom=${1}>${right}</${Box}>` : null}
      </${Box}>
    </${Box}>
  `;
}
