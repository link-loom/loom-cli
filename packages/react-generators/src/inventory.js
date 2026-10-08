import { walkAst } from '@link-loom/devkit';

const ROUTES = /^src\/routes\/.*\.routes\.jsx$/;
const REGISTRIES = Object.freeze({
  navigation: { file: 'src/components/layouts/sidebar/navigation.js', name: 'NAVIGATION' },
  omnisearch: { file: 'src/components/layouts/navbar/omnisearch.registry.js', name: 'OMNISEARCH_CATEGORIES' },
  quickAdd: { file: 'src/components/layouts/navbar/quick-add.registry.js', name: 'QUICK_ADD_ACTIONS' },
  settingsSections: {
    file: 'src/components/pages/management/home/management.sections.js',
    name: 'MANAGEMENT_SECTIONS',
  },
});

const keyOf = (property) => property.key?.name ?? property.key?.value;

/** `{ id, to }` of each object literal in `const <name> = [ … ]` (the registries the generators edit). */
const registryEntries = (project, { file, name }) => {
  const entries = [];
  walkAst(project.ast(file), (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.name !== name || node.init?.type !== 'ArrayExpression') {
      return;
    }

    for (const element of node.init.elements) {
      const fields = Object.fromEntries(
        (element?.properties || [])
          .filter((property) => property.value?.type === 'StringLiteral')
          .map((property) => [keyOf(property), property.value.value]),
      );
      entries.push({ id: fields.id, ...(fields.to ? { to: fields.to } : {}) });
    }
  });
  return entries;
};

/** A route path as written: a string, or a template that reads appConfig (resolved from loom.json). */
const pathValue = (value, manifest) => {
  if (value?.type === 'StringLiteral') {
    return value.value;
  }

  const template = value?.expression;
  if (template?.type === 'StringLiteral') {
    return template.value;
  }

  if (template?.type === 'MemberExpression' && template.object.name === 'appConfig') {
    return manifest[template.property.name];
  }

  if (template?.type !== 'TemplateLiteral') {
    return undefined;
  }

  const parts = template.expressions.map((expression) =>
    expression.type === 'MemberExpression' && expression.object.name === 'appConfig'
      ? manifest[expression.property.name]
      : undefined,
  );
  if (parts.some((part) => part === undefined)) {
    return undefined;
  }

  return template.quasis.map((quasi, index) => `${quasi.value.cooked}${parts[index] ?? ''}`).join('');
};

const joinPath = (parent, child) => (child.startsWith('/') ? child : `${parent.replace(/\/$/, '')}/${child}`);

/**
 * The pages a routes file mounts, with their full paths: lazy page imports paired with the <Route> that renders them,
 * nested routes joined to their parents. Domain routes hang from the app's base route.
 */
const routesOf = (project, file, manifest) => {
  const source = project.read(file);
  const pageByComponent = {};
  walkAst(project.ast(file), (node) => {
    const page =
      node.type === 'VariableDeclarator' && /import\("@pages\/([^"]+)"\)/.exec(source.slice(node.start, node.end));
    if (page) {
      pageByComponent[node.id.name] = `src/pages/${page[1]}.jsx`;
    }
  });

  const routes = [];
  const visit = (node, parentPath) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }

    const isRoute = node.type === 'JSXElement' && node.openingElement.name?.name === 'Route';
    if (!isRoute) {
      Object.entries(node).forEach(([key, value]) => {
        if (key === 'loc') return;
        (Array.isArray(value) ? value : [value]).forEach(
          (child) => child && typeof child === 'object' && visit(child, parentPath),
        );
      });
      return;
    }

    const attribute = (name) => node.openingElement.attributes.find((item) => item.name?.name === name);
    const routePath = pathValue(attribute('path')?.value, manifest);
    const fullPath = routePath === undefined ? parentPath : joinPath(parentPath, routePath);
    const component = attribute('element')?.value?.expression?.openingElement?.name?.name;
    if (pageByComponent[component]) {
      routes.push({ page: pageByComponent[component], path: fullPath });
    }

    node.children.forEach((child) => visit(child, fullPath));
  };
  visit(project.ast(file)?.program, manifest.basePath);
  return routes;
};

/**
 * What a webapp holds, as an agent or the local AI needs it to name things that exist: its layers and platforms,
 * domains, entities, pages with their paths, and the entries of each registry.
 */
export const inventoryOf = (project) => {
  const { manifest } = project;
  const routeFiles = project.files.filter((file) => ROUTES.test(file));
  return {
    type: manifest.type,
    variant: manifest.variant,
    name: manifest.name,
    slug: manifest.slug,
    basePath: manifest.basePath,
    layers: manifest.layers || [],
    platforms: manifest.platforms || [],
    domains: [
      ...new Set(project.files.map((file) => /^src\/routes\/domains\/([^/]+)\//.exec(file)?.[1]).filter(Boolean)),
    ].sort(),
    entities: manifest.entities || [],
    pages: routeFiles.flatMap((file) => routesOf(project, file, manifest)),
    ...Object.fromEntries(
      Object.entries(REGISTRIES).map(([key, registry]) => [
        key,
        project.exists(registry.file) ? registryEntries(project, registry) : [],
      ]),
    ),
  };
};
