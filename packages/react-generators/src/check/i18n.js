import { CHECK_SEVERITIES, walkAst } from '@link-loom/devkit';

const LOCALES = Object.freeze(['en', 'es']);

const keyOf = (property) => property.key?.name ?? property.key?.value;

/** The key paths of the object literal a dictionary module declares (`const en = { … }`). */
const keysOf = (ast) => {
  let root = null;
  walkAst(ast, (node) => {
    if (!root && node.type === 'VariableDeclarator' && node.init?.type === 'ObjectExpression') {
      root = node.init;
    }
  });

  const paths = [];
  const visit = (object, prefix) =>
    object.properties.forEach((property) => {
      const path = prefix ? `${prefix}.${keyOf(property)}` : keyOf(property);
      if (property.value?.type === 'ObjectExpression') {
        visit(property.value, path);
        return;
      }

      paths.push(path);
    });
  if (root) {
    visit(root, '');
  }

  return paths;
};

export const i18nParityRule = {
  id: 'i18n-parity',
  severity: CHECK_SEVERITIES.error,
  summary: 'en.js and es.js have exactly the same keys',
  run: (project) => {
    const keys = Object.fromEntries(LOCALES.map((locale) => [locale, keysOf(project.ast(`src/i18n/${locale}.js`))]));
    return LOCALES.flatMap((locale) => {
      const others = LOCALES.filter((other) => other !== locale);
      return others.flatMap((other) =>
        keys[other]
          .filter((key) => !keys[locale].includes(key))
          .map((key) => ({ file: `src/i18n/${locale}.js`, message: `Missing "${key}", which ${other}.js has` })),
      );
    });
  },
};
