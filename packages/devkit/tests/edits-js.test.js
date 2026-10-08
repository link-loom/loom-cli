import {
  addEntries,
  addImport,
  addMissingProperties,
  appendToArray,
  removeFromArray,
  removeUnusedImport,
  replaceValue,
  setProperty,
} from '../src/index.js';

const REGISTRY = `import appConfig from "@app-config";

/** The sidebar. */
export const NAVIGATION = [
  { id: "overview", to: "/overview" },
  { id: "advanced", to: "/management" },
];
`;

describe('JavaScript edits', () => {
  it('appends to an exported array with the indentation and trailing comma it already has', () => {
    const edited = appendToArray(REGISTRY, {
      name: 'NAVIGATION',
      element: '{ id: "products", to: "/inventory/products" }',
    });

    expect(edited).toContain(
      '  { id: "advanced", to: "/management" },\n  { id: "products", to: "/inventory/products" },\n];',
    );
  });

  it('fills an empty array on its own lines', () => {
    const edited = appendToArray('export const OMNISEARCH_CATEGORIES = [];\n', {
      name: 'OMNISEARCH_CATEGORIES',
      element: '{ id: "products" }',
    });

    expect(edited).toBe('export const OMNISEARCH_CATEGORIES = [\n  { id: "products" },\n];\n');
  });

  it('refuses to add an id the array already has', () => {
    expect(() =>
      appendToArray(REGISTRY, { name: 'NAVIGATION', element: '{ id: "overview" }', id: 'overview' }),
    ).toThrow(expect.objectContaining({ code: 'E_TARGET_EXISTS' }));
  });

  it('reports a file that changed shape with the manual step', () => {
    expect(() =>
      appendToArray('export const NAVIGATION = buildNavigation();\n', {
        name: 'NAVIGATION',
        element: '{}',
        file: 'navigation.js',
      }),
    ).toThrow(
      expect.objectContaining({ code: 'E_EDIT_SHAPE', details: expect.objectContaining({ path: 'navigation.js' }) }),
    );
    expect(() => appendToArray('const x = [];\n', { name: 'NAVIGATION', element: '{}' })).toThrow(
      expect.objectContaining({ code: 'E_EDIT_SHAPE' }),
    );
  });

  it('replaces the value of a constant', () => {
    const source = 'export const THEME_COLORS = {\n  brandPrimary: "#3c4876",\n};\n\nexport const OTHER = 1;\n';

    expect(replaceValue(source, { name: 'THEME_COLORS', value: '{ brandPrimary: "#1f4e79" }' })).toBe(
      'export const THEME_COLORS = { brandPrimary: "#1f4e79" };\n\nexport const OTHER = 1;\n',
    );
  });

  it('sets a nested property, or adds it when missing', () => {
    const source =
      'const appConfig = {\n  brand: {\n    logo: "/a.svg",\n    themeColor: "#3c4876",\n  },\n};\n\nexport default appConfig;\n';

    expect(setProperty(source, { name: 'appConfig', path: ['brand', 'themeColor'], value: '#1f4e79' })).toContain(
      '    themeColor: "#1f4e79",',
    );
    expect(setProperty(source, { name: 'appConfig', path: ['brand', 'mark'], value: '/m.svg' })).toContain(
      '    themeColor: "#3c4876",\n    mark: "/m.svg",\n  },',
    );
  });

  it('adds missing copy keys deep in a dictionary and reports the ones that exist', () => {
    const source = 'const en = {\n  nav: {\n    overview: "Overview",\n  },\n};\n\nexport default en;\n';
    const { source: edited, conflicts } = addMissingProperties(source, {
      name: 'en',
      tree: { nav: { overview: 'Home', products: 'Products' }, inventory: { product: { title: 'Products' } } },
    });

    expect(edited).toBe(
      'const en = {\n  nav: {\n    overview: "Overview",\n    products: "Products",\n  },\n  inventory: {\n    product: {\n      title: "Products",\n    },\n  },\n};\n\nexport default en;\n',
    );
    expect(conflicts).toEqual(['nav.overview']);
  });
});

describe('JavaScript edits for generators', () => {
  it('puts an entry just before the element with the given id', () => {
    const edited = appendToArray(REGISTRY, {
      name: 'NAVIGATION',
      element: '{ id: "products", to: "/inventory/products" }',
      id: 'products',
      before: 'advanced',
    });

    expect(edited).toContain(
      '  { id: "overview", to: "/overview" },\n  { id: "products", to: "/inventory/products" },\n  { id: "advanced", to: "/management" },',
    );
  });

  it('appends at the end when the anchor is not there', () => {
    const edited = appendToArray(REGISTRY, { name: 'NAVIGATION', element: '{ id: "x" }', before: 'missing' });

    expect(edited).toContain('  { id: "advanced", to: "/management" },\n  { id: "x" },\n];');
  });

  it('adds raw entries to an object and reports the ones it has', () => {
    const source = 'export const ICONS = Object.freeze({\n  add: AddOutlined,\n  apps: AppsOutlined,\n});\n';
    const { source: edited, conflicts } = addEntries(source, {
      name: 'ICONS',
      entries: { apps: 'Other', inventory: 'Inventory2Outlined', people: 'PeopleOutlined' },
    });

    expect(edited).toBe(
      'export const ICONS = Object.freeze({\n  add: AddOutlined,\n  apps: AppsOutlined,\n  inventory: Inventory2Outlined,\n  people: PeopleOutlined,\n});\n',
    );
    expect(conflicts).toEqual(['apps']);
    expect(addEntries('const MAP = {};\n', { name: 'MAP', entries: { a: 'A', b: 'B' } }).source).toBe(
      'const MAP = {\n  a: A,\n  b: B,\n};\n',
    );
  });

  it('adds names to a multi-line import and skips the ones it already has', () => {
    const source =
      'import { createElement } from "react";\nimport {\n  AddOutlined,\n  AppsOutlined,\n} from "@mui/icons-material";\n\nexport const A = 1;\n';
    const edited = addImport(source, { from: '@mui/icons-material', named: ['AppsOutlined', 'Inventory2Outlined'] });

    expect(edited).toBe(
      'import { createElement } from "react";\nimport {\n  AddOutlined,\n  AppsOutlined,\n  Inventory2Outlined,\n} from "@mui/icons-material";\n\nexport const A = 1;\n',
    );
    expect(addImport(edited, { from: '@mui/icons-material', named: ['AddOutlined'] })).toBe(edited);
  });

  it('adds to a one-line import or writes a new one after the last import', () => {
    expect(addImport('import { a } from "x";\n', { from: 'x', named: ['b'] })).toBe('import { a, b } from "x";\n');
    expect(addImport('import { a } from "x";\n\nconst y = 1;\n', { from: 'z', defaultName: 'Z', named: ['w'] })).toBe(
      'import { a } from "x";\nimport Z, { w } from "z";\n\nconst y = 1;\n',
    );
    expect(addImport('const y = 1;\n', { from: 'z', named: ['w'] })).toBe('import { w } from "z";\n\nconst y = 1;\n');
  });
});

describe('appending inside an object', () => {
  const SECTIONS = 'export const PLATFORM_SECTIONS = {};\n';

  it('starts the list of a key the object does not have, then appends to it', () => {
    const first = appendToArray(SECTIONS, {
      name: 'PLATFORM_SECTIONS',
      path: ['veripass'],
      element: '{ id: "users" }',
    });
    const second = appendToArray(first, {
      name: 'PLATFORM_SECTIONS',
      path: ['veripass'],
      element: '{ id: "teams" }',
      id: 'teams',
    });

    expect(first).toBe('export const PLATFORM_SECTIONS = {\n  veripass: [\n    { id: "users" },\n  ],\n};\n');
    expect(second).toBe(
      'export const PLATFORM_SECTIONS = {\n  veripass: [\n    { id: "users" },\n    { id: "teams" },\n  ],\n};\n',
    );
    expect(() =>
      appendToArray(second, { name: 'PLATFORM_SECTIONS', path: ['veripass'], element: '{}', id: 'users' }),
    ).toThrow(expect.objectContaining({ code: 'E_TARGET_EXISTS' }));
  });
});

describe('removing what a generator added', () => {
  it('removes an entry with its line, wherever it sits', () => {
    const source =
      'export const NAVIGATION = [\n  { id: "overview" },\n  { id: "products" },\n  {\n    id: "advanced",\n  },\n];\n';

    expect(removeFromArray(source, { name: 'NAVIGATION', id: 'products' })).toBe(
      'export const NAVIGATION = [\n  { id: "overview" },\n  {\n    id: "advanced",\n  },\n];\n',
    );
    expect(removeFromArray(source, { name: 'NAVIGATION', id: 'advanced' })).toBe(
      'export const NAVIGATION = [\n  { id: "overview" },\n  { id: "products" },\n];\n',
    );
    expect(removeFromArray(source, { name: 'NAVIGATION', id: 'missing' })).toBe(source);
  });

  it('drops an import nothing uses any more, and keeps one still in use', () => {
    const unused = 'import A from "@services/a";\nimport { b } from "b";\n\nexport const X = [b];\n';
    const used = 'import A from "@services/a";\n\nexport const X = [A];\n';

    expect(removeUnusedImport(unused, { from: '@services/a' })).toBe(
      'import { b } from "b";\n\nexport const X = [b];\n',
    );
    expect(removeUnusedImport(used, { from: '@services/a' })).toBe(used);
  });
});

describe('TypeScript modules', () => {
  it('edits a .ts registry and dictionary through their `as const` and type annotations', () => {
    const registry =
      "import type { NavLink } from './types';\n\nexport const HEADER_NAV: NavLink[] = [\n  { id: 'pricing', path: '/pricing' },\n] as const;\n";
    const dictionary = "export const COPY = {\n  nav: { signIn: 'Sign in' },\n} as const;\n";

    expect(
      appendToArray(registry, { name: 'HEADER_NAV', element: "{ id: 'company', path: '/company' }", file: 'nav.ts' }),
    ).toContain("  { id: 'pricing', path: '/pricing' },\n  { id: 'company', path: '/company' },\n] as const;");
    expect(
      addMissingProperties(dictionary, { name: 'COPY', tree: { nav: { signUp: 'Sign up' } }, file: 'en.ts' }).source,
    ).toContain("signUp: 'Sign up'");
    expect(() => appendToArray(registry, { name: 'HEADER_NAV', element: '{}', file: 'nav.js' })).toThrow(
      expect.objectContaining({ code: 'E_EDIT_SHAPE' }),
    );
  });
});

describe('quote style', () => {
  it('writes strings and imports with the quote the module already uses', () => {
    const single = "import a from './a';\n\nexport const COPY = {\n  title: 'Hi',\n};\n";

    expect(addMissingProperties(single, { name: 'COPY', tree: { deck: 'It\'s "here"' } }).source).toContain(
      "deck: 'It\\'s \"here\"',",
    );
    expect(addImport(single, { from: './b', defaultName: 'B' })).toContain("import B from './b';");
    expect(setProperty(single, { name: 'COPY', path: ['tags'], value: ['x', 'y'] })).toContain("tags: ['x', 'y'],");
  });
});

describe('nested lists', () => {
  it('appends to the list of an entry named by its id', () => {
    const columns =
      "export const FOOTER_COLUMNS = [\n  {\n    id: 'company',\n    links: [\n      { id: 'contact' },\n    ],\n  },\n];\n";

    expect(
      appendToArray(columns, {
        name: 'FOOTER_COLUMNS',
        path: ['company', 'links'],
        element: "{ id: 'about' }",
        id: 'about',
      }),
    ).toContain("      { id: 'contact' },\n      { id: 'about' },\n");
    expect(() => appendToArray(columns, { name: 'FOOTER_COLUMNS', path: ['legal', 'links'], element: '{}' })).toThrow(
      expect.objectContaining({ code: 'E_EDIT_SHAPE' }),
    );
  });
});
