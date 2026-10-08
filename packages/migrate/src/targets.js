import path from 'node:path';

import { kebabCase, pascalCase } from './naming.js';

const ROLE_FOLDERS = new Set(['list', 'record', 'quick-actions']);

const extensionOf = (file, source = '') =>
  file.endsWith('.jsx') || /<[A-Za-z][\w.]*[\s/>]/.test(source) ? '.jsx' : '.js';

/**
 * Where a carried-over file goes in the new layout, from its decision: the folders and suffixes `link-loom check`
 * expects. Pages and components keep their own names under the domain they belong to.
 */
export const targetOf = (decision, source = '') => {
  const name = pascalCase(decision.name || path.basename(decision.file).replace(/\.(component\.)?[jt]sx?$/, ''));
  const domain = kebabCase(decision.domain || 'app');
  const Domain = pascalCase(domain);
  switch (decision.kind) {
    case 'page':
      return `src/pages/${domain}/${Domain}${name}.page.jsx`;
    case 'service': {
      const entity = kebabCase(decision.entity || name);
      return decision.base
        ? `src/services/base/${entity}.service.js`
        : `src/services/${domain}/${entity}/${domain}-${entity}.service.js`;
    }
    case 'hook':
      return `src/hooks/${name.charAt(0).toLowerCase()}${name.slice(1)}.hook${extensionOf(decision.file, source)}`;
    case 'constants':
      return decision.name === 'theme'
        ? 'src/constants/theme.js'
        : `src/constants/${kebabCase(decision.name)}.constants.js`;
    case 'utils':
      return `src/utils/${kebabCase(decision.name || name)}.utils.js`;
    default:
      break;
  }

  if (decision.role === 'utils') {
    return `src/utils/${kebabCase(name)}.utils.js`;
  }

  if (decision.role === 'shared') {
    return `src/components/shared/${kebabCase(name)}/${name}.component.jsx`;
  }

  if (ROLE_FOLDERS.has(decision.role)) {
    return `src/components/pages/${domain}/${kebabCase(decision.entity || domain)}/${decision.role}/${name}.component.jsx`;
  }

  return `src/components/pages/${domain}/${kebabCase(name)}/${name}.component.jsx`;
};

// The code `link-loom check` wants a test for: components, hooks, services and utilities.
const TESTED = /^src\/(components|hooks|services|utils)\//;

/** The unit test a carried-over file needs (null for pages and constants), as `link-loom check` mirrors it. */
export const testPathOf = (target) => {
  if (!TESTED.test(target)) return null;
  const base = target
    .replace(/^src\//, 'tests/')
    .replace(/\.(component|hook)\.(jsx|js)$/, '')
    .replace(/\.(jsx|js)$/, '');
  return `${base}.test.${target.endsWith('.jsx') ? 'jsx' : 'js'}`;
};
