import { walkAst } from '@link-loom/devkit';

const keyOf = (property) => property.key?.name ?? property.key?.value;

/** The string fields of each object literal of `const <name> = [ … ]`, with their nested lists by key. */
const entriesOf = (project, file, name) => {
  const entries = [];
  const objectOf = (node) =>
    Object.fromEntries(
      (node?.properties || [])
        .filter((property) => property.value?.type === 'StringLiteral' || property.value?.type === 'ArrayExpression')
        .map((property) => [
          keyOf(property),
          property.value.type === 'StringLiteral'
            ? property.value.value
            : property.value.elements.filter((element) => element?.type === 'ObjectExpression').map(objectOf),
        ]),
    );
  walkAst(project.ast(file), (node) => {
    const value = node.type === 'VariableDeclarator' && node.id?.name === name ? node.init : null;
    const list = value?.type === 'TSAsExpression' ? value.expression : value;
    if (list?.type === 'ArrayExpression') {
      list.elements.forEach((element) => entries.push(objectOf(element)));
    }
  });
  return entries;
};

const sectionsOf = (project, page) =>
  entriesOf(project, `src/views/${page}/sections.ts`, 'SECTIONS').map((entry) => entry.id);

/** Every page of the site: its address (without the locale), the view it renders and that view's sections. */
const pagesOf = (project) =>
  project.files
    .filter((file) => file.startsWith('src/pages/en/') && file.endsWith('.astro'))
    .map((file) => {
      const route = file.slice('src/pages/en'.length, -'.astro'.length).replace(/\/index$/, '') || '/';
      const view = /@views\/([a-z0-9-]+)\//.exec(project.read(file) || '')?.[1];
      return { path: route, ...(view ? { view, sections: sectionsOf(project, view) } : {}) };
    });

const postsOf = (project) => {
  const slugs = new Map();
  project.files
    .filter((file) => /^src\/content\/blog\/.+\.md$/.test(file))
    .forEach((file) => {
      const [, slug, spanish] = /^src\/content\/blog\/(.+?)(\.es)?\.md$/.exec(file);
      slugs.set(slug, [...(slugs.get(slug) || []), spanish ? 'es' : 'en']);
    });
  return [...slugs].map(([slug, locales]) => ({ slug, locales: locales.sort() }));
};

/**
 * What a landing holds, as an agent or the local AI needs it to name things that exist: its layers, pages with their
 * sections, the header menu and footer columns, and the blog's posts and categories.
 */
export const inventoryOf = (project) => {
  const { manifest } = project;
  return {
    type: manifest.type,
    name: manifest.name,
    slug: manifest.slug,
    url: manifest.url,
    defaultLocale: manifest.defaultLocale,
    layers: manifest.layers || [],
    pages: pagesOf(project),
    headerNav: entriesOf(project, 'src/data/nav.ts', 'HEADER_NAV').map(({ id, path, href }) => ({
      id,
      ...(path ? { path } : { href }),
    })),
    footerColumns: entriesOf(project, 'src/data/nav.ts', 'FOOTER_COLUMNS').map((column) => ({
      id: column.id,
      links: (column.links || []).map((link) => link.id),
    })),
    ...(manifest.layers?.includes('blog')
      ? { posts: postsOf(project), categories: (manifest.blog?.categories || []).map((category) => category.id) }
      : {}),
  };
};
