import { Box, Text } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';

const MARKERS = Object.freeze([
  ['create', '+', COLORS.success],
  ['modify', '~', COLORS.warning],
  ['delete', '-', COLORS.error],
]);

/** The plan as a short list: the first files of each action and how many more there are. */
export function PlanTree({ plan, limit = 8, filesLabel = 'files' }) {
  return html`
    <${Box} flexDirection="column">
      ${MARKERS.filter(([action]) => plan?.[action]?.length).map(([action, marker, color]) => {
        const entries = plan[action];
        const rest = entries.length - limit;
        return html`
          <${Box} key=${action} flexDirection="column" marginBottom=${1}>
            <${Text} color=${color}>${marker} ${action} · ${entries.length} ${filesLabel}</${Text}>
            ${entries.slice(0, limit).map((entry) => html`<${Text} key=${entry.path} color=${COLORS.muted}>    ${entry.path}</${Text}>`)}
            ${rest > 0 ? html`<${Text} color=${COLORS.muted}>    … +${rest}</${Text}>` : null}
          </${Box}>
        `;
      })}
    </${Box}>
  `;
}
