import fs from 'node:fs';
import path from 'node:path';

import {
  ERROR_CODES,
  LoomError,
  addEntries,
  addImport,
  addMissingProperties,
  appendToArray,
  renderDirectory,
  setProperty,
} from '@link-loom/devkit';

/** The files of a webapp the `add` generators edit. */
export const FILES = Object.freeze({
  manifest: 'loom.json',
  icons: 'src/constants/iconLibrary.js',
  navigation: 'src/components/layouts/sidebar/navigation.js',
  omnisearch: 'src/components/layouts/navbar/omnisearch.registry.js',
  quickAdd: 'src/components/layouts/navbar/quick-add.registry.js',
  managementSections: 'src/components/pages/management/home/management.sections.js',
  platformSections: 'src/components/pages/platforms/hub/platform.sections.js',
  dictionary: (locale) => `src/i18n/${locale}.js`,
});

export const LOCALES = Object.freeze(['en', 'es']);
export const ADVANCED_SETTINGS_ID = 'advanced';

/** Icons a generator may register by key, beside the ones the app already has. Outlined only. */
export const ICON_CATALOG = Object.freeze({
  list: 'ListAltOutlined',
  inventory: 'Inventory2Outlined',
  people: 'PeopleOutlined',
  folder: 'FolderOutlined',
  document: 'DescriptionOutlined',
  tag: 'LocalOfferOutlined',
  calendar: 'CalendarMonthOutlined',
  cart: 'ShoppingCartOutlined',
  task: 'TaskAltOutlined',
  keys: 'KeyOutlined',
  building: 'BusinessOutlined',
  payments: 'PaymentsOutlined',
  analytics: 'AnalyticsOutlined',
  dashboard: 'SpaceDashboardOutlined',
  chart: 'BarChartOutlined',
  map: 'MapOutlined',
  mail: 'MailOutlined',
  security: 'SecurityOutlined',
  warehouse: 'WarehouseOutlined',
  category: 'CategoryOutlined',
  today: 'TodayOutlined',
  insights: 'InsightsOutlined',
  settings: 'SettingsOutlined',
  home: 'HomeOutlined',
  store: 'StorefrontOutlined',
  receipt: 'ReceiptLongOutlined',
  inbox: 'InboxOutlined',
  notifications: 'NotificationsOutlined',
  help: 'HelpOutline',
  add: 'AddCircleOutline',
  diamond: 'DiamondOutlined',
  collections: 'CollectionsBookmarkOutlined',
  star: 'StarOutline',
});

export const ICON_KEYS = Object.freeze(Object.keys(ICON_CATALOG));

/** The tree seen from a project folder inside it: how `create webapp` adds the app's first pieces. */
export const within = (tree, directory) =>
  directory
    ? {
        root: path.join(tree.root, directory),
        exists: (file) => tree.exists(`${directory}/${file}`),
        read: (file, encoding) => tree.read(`${directory}/${file}`, encoding),
        create: (file, content) => tree.create(`${directory}/${file}`, content),
        overwrite: (file, content) => tree.overwrite(`${directory}/${file}`, content),
        delete: (file) => tree.delete(`${directory}/${file}`),
      }
    : tree;

/** Every file on disk under `directory` of the project, relative to the project. */
export const filesUnder = (tree, directory) => {
  const walk = (relative) => {
    const fullPath = path.join(tree.root, relative);
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
      const child = `${relative}/${entry.name}`;
      return entry.isDirectory() ? walk(child) : [child];
    });
  };
  return walk(directory);
};

/** Refuses to run outside a webapp project. */
export const requireWebapp = (manifest, generator) => {
  if (manifest?.type !== 'webapp') {
    throw new LoomError(ERROR_CODES.usage, `\`add ${generator}\` runs inside a webapp project`);
  }
};

export const readRequired = (tree, file, purpose = 'the piece cannot be registered') => {
  const content = tree.read(file);
  if (content === null) {
    throw new LoomError(ERROR_CODES.editShape, `${file} is missing; ${purpose}`, { path: file });
  }

  return content;
};

/** Renders template folders into the tree; a template that renders empty is a piece this run does not need. */
export const renderInto = (tree, directories, data) => {
  for (const file of directories.flatMap((directory) => renderDirectory(directory, data))) {
    if (String(file.content).trim()) {
      tree.create(file.path, file.content);
    }
  }
};

/**
 * Adds copy to both dictionaries: `trees` is `{ en, es }`. A key under one of the `owned` prefixes that already
 * exists is a conflict (the piece is already there); other existing keys (shared words) are left alone.
 */
export const addCopy = (tree, trees, { owned = [], replace = false } = {}) => {
  for (const locale of LOCALES) {
    const file = FILES.dictionary(locale);
    const { source, conflicts } = addMissingProperties(readRequired(tree, file), {
      name: locale,
      file,
      tree: trees[locale],
    });
    const clash = conflicts.find((key) => owned.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
    if (clash && replace) {
      tree.overwrite(file, replaceOwned(source, { name: locale, file, owned, values: trees[locale] }));
      continue;
    }

    if (clash) {
      throw new LoomError(ERROR_CODES.targetExists, `${file} already has the copy key ${clash}`, {
        path: file,
        key: clash,
        next: ['Pass --replace --yes to rewrite it'],
      });
    }

    tree.overwrite(file, source);
  }
};

const valueAt = (tree, dottedPath) => dottedPath.split('.').reduce((value, key) => value?.[key], tree);

/** Writes each owned copy path again with its new value (regenerating a piece replaces its own copy). */
const replaceOwned = (source, { name, file, owned, values }) =>
  owned.reduce(
    (current, dottedPath) =>
      setProperty(current, { name, path: dottedPath.split('.'), value: valueAt(values, dottedPath), file }),
    source,
  );

/** Registers a catalog icon in src/constants/iconLibrary.js unless the app already has its key. */
export const addIcon = (tree, icon) => {
  const source = readRequired(tree, FILES.icons);
  if (new RegExp(`^\\s+${icon}:`, 'm').test(source) || !ICON_CATALOG[icon]) {
    return;
  }

  const component = ICON_CATALOG[icon];
  const imported = addImport(source, { from: '@mui/icons-material', named: [component], file: FILES.icons });
  tree.overwrite(
    FILES.icons,
    addEntries(imported, { name: 'ICONS', entries: { [icon]: component }, file: FILES.icons }).source,
  );
};

/** Appends a row to the sidebar, before Advanced settings (or before the row `before` names; null: at the end). */
export const addNavigationEntry = (tree, { id, labelKey, icon, to, before = ADVANCED_SETTINGS_ID, sectionKey }) => {
  const section = sectionKey ? `, sectionKey: "${sectionKey}"` : '';
  const element = `{ id: "${id}", kind: "link", labelKey: "${labelKey}", icon: "${icon}", to: "${to}"${section} }`;
  tree.overwrite(
    FILES.navigation,
    appendToArray(readRequired(tree, FILES.navigation), {
      name: 'NAVIGATION',
      element,
      id,
      before,
      file: FILES.navigation,
    }),
  );
};

/** Whether the sidebar already has a row (or group) with this id. */
export const hasNavigationEntry = (tree, id) =>
  new RegExp(`\\bid:\\s*["']${id}["']`).test(readRequired(tree, FILES.navigation));

/** Appends a group row (a collapsible title with its links) to the sidebar, with no links yet. */
export const addNavigationGroup = (tree, { id, labelKey, icon, before = ADVANCED_SETTINGS_ID, sectionKey }) => {
  const section = sectionKey ? `, sectionKey: "${sectionKey}"` : '';
  const element = `{ id: "${id}", kind: "group", labelKey: "${labelKey}", icon: "${icon}"${section}, items: [] }`;
  tree.overwrite(
    FILES.navigation,
    appendToArray(readRequired(tree, FILES.navigation), {
      name: 'NAVIGATION',
      element,
      id,
      before,
      file: FILES.navigation,
    }),
  );
};

/** Appends a link to a group row of the sidebar. */
export const addNavigationGroupItem = (tree, { group, id, labelKey, icon, to }) => {
  const element = `{ id: "${id}", labelKey: "${labelKey}", icon: "${icon}", to: "${to}" }`;
  tree.overwrite(
    FILES.navigation,
    appendToArray(readRequired(tree, FILES.navigation), {
      name: 'NAVIGATION',
      path: [group, 'items'],
      element,
      id,
      file: FILES.navigation,
    }),
  );
};

/** `{ en: …, es: … }` for a copy path (`a.b.c`) and a value per locale. */
export const copyTreeAt = (path, values) =>
  Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      path
        .split('.')
        .reverse()
        .reduce((tree, key) => ({ [key]: tree }), values[locale]),
    ]),
  );
