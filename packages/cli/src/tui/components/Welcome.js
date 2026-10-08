import { html } from '../html.js';
import { Card } from './Card.js';
import { MASCOT_STATES } from './Mascot.js';

export { titledBorder } from './Card.js';

/** The welcome: the person greeted by name, Loomi, where the CLI is running, and the tips (or the project) beside. */
export function Welcome({ strings, version, person, cwd, columns, animate = true, sections = [] }) {
  const greeting = person ? strings.welcome.greetingNamed.replace('{name}', person) : strings.welcome.greeting;
  return html`<${Card}
    version=${version}
    heading=${greeting}
    state=${MASCOT_STATES.idle}
    caption=${[{ text: strings.welcome.intro }, ...(cwd ? [{ text: cwd, muted: true, truncate: true }] : [])]}
    sections=${sections}
    animate=${animate}
    columns=${columns}
    hideSectionsWhenNarrow=${true}
  />`;
}
