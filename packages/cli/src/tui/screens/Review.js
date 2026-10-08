import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { html } from '../html.js';
import { COLORS } from '../theme.js';
import { Mascot, MASCOT_STATES } from '../components/Mascot.js';
import { PlanTree } from '../components/PlanTree.js';
import { Swatches } from '../components/Swatches.js';

/** Shows the dry-run plan before anything is written; enter confirms, esc cancels. */
export function Review({ command, strings, animate, preview, onConfirm, onCancel, onError }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    preview().then(setResult).catch(onError);
  }, []);

  useInput((input, key) => {
    if (!result) {
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      onConfirm(result);
    }
  });

  if (!result) {
    return html`<${Box} paddingX=${1}><${Mascot} state=${MASCOT_STATES.working} message=${strings.mascot.working} animate=${animate} /></${Box}>`;
  }

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      <${Text} bold>${strings.reviewTitle}</${Text}>
      <${Box} marginY=${1}><${PlanTree} plan=${result.plan} filesLabel=${strings.files} /></${Box}>
      ${
        result.project?.brand
          ? html`<${Box} marginBottom=${1}><${Swatches} colors=${result.project.brand} labels=${strings.palette} /></${Box}>`
          : null
      }
      ${result.warnings.map((warning) => html`<${Text} key=${warning} color=${COLORS.warning}>! ${warning}</${Text}>`)}
      <${Text} color=${COLORS.muted}>${strings.agentCommand}</${Text}>
      <${Text}>  ${command}</${Text}>
      <${Box} marginTop=${1}><${Text} color=${COLORS.muted}>${strings.reviewHint}</${Text}></${Box}>
    </${Box}>
  `;
}
