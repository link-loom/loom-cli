const flagOf = (field) => `--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/**
 * What to run after an error, from its code: what the error itself says to do next, or the command again with the
 * flag it asked for. Nothing for an error with no known way out.
 */
export const fixesFor = (error, command = '') => {
  const details = error?.details || {};
  if (details.next?.length) {
    return details.next;
  }

  if (error?.code === 'E_CONFIRMATION_REQUIRED' && command) {
    return [`${command} --yes`];
  }

  if (error?.code === 'E_VALIDATION' && details.missing?.length && command) {
    return [`${command} ${details.missing.map((field) => `${flagOf(field)} <value>`).join(' ')}`];
  }

  if (error?.code === 'E_CHECK_FAILED') {
    return ['npx link-loom check --json'];
  }

  if (error?.code === 'E_FETCH') {
    return [command ? `${command}  (again, once the connection is back)` : 'Run it again once the connection is back'];
  }

  return [];
};
