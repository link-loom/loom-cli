import { fileURLToPath } from 'node:url';

import {
  ERROR_CODES,
  LoomError,
  addImport,
  appendToArray,
  removeFromArray,
  removeUnusedImport,
  stringifyJson,
} from '@link-loom/devkit';

import {
  FILES,
  ICON_CATALOG,
  addCopy as addCopyTrees,
  addIcon,
  addNavigationEntry,
  filesUnder,
  readRequired,
  renderInto,
  requireWebapp,
  within,
} from '../shared/project.js';
import { COMMON_COPY, entityCopyEn, entityCopyEs } from './copy.js';
import { pairsOf, parseCustomActions, parseFields } from './fields.js';
import { camelCase, entityNames, inlineOf, pluralOf, sentenceCase } from './naming.js';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const FILES_DIR = here('./files/');
const COMMAND_CENTER_FILES_DIR = here('./files-command-center/');
const SERVICE_FILES_DIR = here('../shared/service-files/');

/** The icons an entity can take: the shared catalog. */
export const ENTITY_ICONS = ICON_CATALOG;

const LIST_PRESETS = Object.freeze({
  standard: { viewModes: ['list', 'grid'], defaultView: 'list', description: true },
  compact: { viewModes: null, defaultView: 'list', description: false },
  cards: { viewModes: ['grid', 'list'], defaultView: 'grid', description: true },
});

const COMMAND_CENTER_LAYER = 'command-center';

const CATALOG_ACTIONS = Object.freeze([
  'quickview',
  'edit',
  'open-page',
  'open-new-tab',
  'copy-id',
  'copy-link',
  'delete',
]);

/** Labels that rename a catalog action for this entity (delete=Revoke), from the same lists as the custom ones. */
const catalogLabelsOf = (options) => {
  const en = pairsOf(options.actionLabelsEn, 'actionLabelsEn');
  const es = pairsOf(options.actionLabelsEs, 'actionLabelsEs');
  return CATALOG_ACTIONS.filter((id) => en[id] || es[id]).map((id) => ({
    id,
    key: camelCase(id),
    labelEn: en[id] || es[id],
    labelEs: es[id] || en[id],
  }));
};

const labelsOf = (options) => {
  const singularEn = options.singularEn || sentenceCase(options.entity);
  const pluralEn = options.pluralEn || sentenceCase(options.plural || pluralOf(options.entity));
  return {
    singularEn,
    pluralEn,
    singularEs: options.singularEs || singularEn,
    pluralEs: options.pluralEs || options.singularEs || pluralEn,
    genderEs: options.genderEs,
    descriptionEn: options.descriptionEn,
    descriptionEs: options.descriptionEs,
  };
};

const missingSpanish = ({ options, fields, actions }) => [
  ...(options.singularEs && options.pluralEs ? [] : ['singularEs/pluralEs']),
  ...fields.filter((field) => !field.translated).map((field) => `fieldLabelsEs ${field.name}`),
  ...actions.filter((action) => !action.translated).map((action) => `actionLabelsEs ${action.id}`),
];

/** The copy of the entity and the shared record words, into each dictionary; an entity that is there is a conflict. */
const addCopy = (tree, { names, labels, fields, actions, catalogLabels, replace }) => {
  const copies = {
    en: entityCopyEn({ labels, fields, actions, catalogLabels }),
    es: entityCopyEs({ labels, fields, actions, catalogLabels }),
  };
  addCopyTrees(
    tree,
    Object.fromEntries(
      ['en', 'es'].map((locale) => [
        locale,
        { common: COMMON_COPY[locale], [names.domainKey]: { [names.entityKey]: copies[locale] } },
      ]),
    ),
    { owned: [names.copyPath], replace },
  );
};

const addNavigation = (tree, { names, icon }) =>
  addNavigationEntry(tree, {
    id: `${names.domain}-${names.plural}`,
    labelKey: `${names.copyPath}.plural`,
    icon,
    to: names.listPath,
  });

// Omnisearch reads an item's name, title or label by itself; any other title field is named for it.
const OMNISEARCH_TITLES = new Set(['name', 'title', 'label']);

const addOmnisearchCategory = (tree, { names, icon, rowClick, titleField }) => {
  const id = `${names.domain}-${names.plural}`;
  const to = rowClick === 'page' ? `\`${names.listPath}/\${item.id}\`` : `\`${names.listPath}?id=\${item.id}\``;
  const element = [
    '{',
    `    id: "${id}",`,
    `    labelKey: "${names.copyPath}.plural",`,
    `    service: ${names.serviceClass},`,
    '    payload: () => ({ queryselector: "search" }),',
    `    icon: "${icon}",`,
    ...(OMNISEARCH_TITLES.has(titleField) ? [] : [`    itemLabel: (item) => item.${titleField},`]),
    `    to: (item) => ${to},`,
    `    createTo: "${names.listPath}?new=1",`,
    `    createLabelKey: "${names.copyPath}.new",`,
    '  }',
  ].join('\n');
  const imported = addImport(readRequired(tree, FILES.omnisearch), {
    from: `@services/${names.domain}/${names.entity}/${names.serviceFile}`,
    defaultName: names.serviceClass,
    file: FILES.omnisearch,
  });
  tree.overwrite(
    FILES.omnisearch,
    appendToArray(imported, { name: 'OMNISEARCH_CATEGORIES', element, id, file: FILES.omnisearch }),
  );
};

const addQuickAdd = (tree, { names, icon }) => {
  const id = `${names.domain}-${names.entity}`;
  const element = `{ id: "${id}", labelKey: "${names.copyPath}.new", descriptionKey: "${names.copyPath}.quickAddHint", icon: "${icon}", to: "${names.listPath}?new=1" }`;
  tree.overwrite(
    FILES.quickAdd,
    appendToArray(readRequired(tree, FILES.quickAdd), { name: 'QUICK_ADD_ACTIONS', element, id, file: FILES.quickAdd }),
  );
};

/** Everything an earlier `add entity` wrote for this entity: its folders and files, its registry entries. */
const removeEntity = (tree, names) => {
  const generated = [
    `src/components/pages/${names.domain}/${names.entity}`,
    `src/services/${names.domain}/${names.entity}`,
    `tests/components/pages/${names.domain}/${names.entity}`,
    `tests/services/${names.domain}/${names.entity}`,
    `tests/${names.domain}/${names.entity}`,
  ].flatMap((directory) => filesUnder(tree, directory));
  const single = [
    `src/pages/${names.domain}/${names.Prefix}List.page.jsx`,
    `src/pages/${names.domain}/${names.Prefix}Detail.page.jsx`,
    `src/routes/domains/${names.domain}/${names.routesFile}.jsx`,
  ].filter((file) => tree.exists(file));
  for (const file of [...generated, ...single]) {
    tree.delete(file);
  }

  const registries = [
    [FILES.navigation, 'NAVIGATION', `${names.domain}-${names.plural}`],
    [FILES.omnisearch, 'OMNISEARCH_CATEGORIES', `${names.domain}-${names.plural}`],
    [FILES.quickAdd, 'QUICK_ADD_ACTIONS', `${names.domain}-${names.entity}`],
  ];
  for (const [file, name, id] of registries) {
    tree.overwrite(file, removeFromArray(readRequired(tree, file), { name, id, file }));
  }

  tree.overwrite(
    FILES.omnisearch,
    removeUnusedImport(readRequired(tree, FILES.omnisearch), {
      from: `@services/${names.domain}/${names.entity}/${names.serviceFile}`,
      file: FILES.omnisearch,
    }),
  );
};

const recordEntity = (tree, manifest, entry) => {
  const others = (manifest.entities || []).filter(
    (candidate) => !(candidate.domain === entry.domain && candidate.entity === entry.entity),
  );
  tree.overwrite(FILES.manifest, stringifyJson({ ...manifest, entities: [...others, entry] }));
};

/**
 * `add entity`: a CRUD of one entity, from the kit of @link-loom/react-sdk. Writes the list, the record (over the
 * list and as a page), the service, the routes and the tests, then registers the entity in the sidebar, Omnisearch,
 * the + menu, the dictionaries and loom.json, each by a structural edit. `context.directory` runs it on a project
 * folder of the tree instead of its root.
 */
export default async function entityGenerator(tree, options, context = {}) {
  const manifest = context.project;
  requireWebapp(manifest, 'entity');

  const files = context.directory ? within(tree, context.directory) : tree;
  const names = entityNames(options);
  const entityDir = `src/components/pages/${names.domain}/${names.entity}`;
  if (files.exists(entityDir) && !options.replace) {
    throw new LoomError(ERROR_CODES.targetExists, `The entity already exists: ${entityDir}`, {
      path: entityDir,
      next: ['Add --replace to generate it again from new options (hand edits to its files are lost)'],
    });
  }

  const fields = parseFields({
    specs: options.fields,
    labelsEn: pairsOf(options.fieldLabelsEn, 'fieldLabelsEn'),
    labelsEs: pairsOf(options.fieldLabelsEs, 'fieldLabelsEs'),
  });
  const actions = parseCustomActions({
    specs: options.customActions,
    fields,
    labelsEn: pairsOf(options.actionLabelsEn, 'actionLabelsEn'),
    labelsEs: pairsOf(options.actionLabelsEs, 'actionLabelsEs'),
  });
  const labels = labelsOf(options);
  const catalogLabels = catalogLabelsOf(options);
  const scoped = options.scope === 'organization';
  const omnisearch = options.omnisearch && !scoped;
  const navigation = options.navigation && options.section === 'app';
  const createDefaults = Object.fromEntries(
    Object.entries(pairsOf(options.createDefaults, 'createDefaults')).map(([key, value]) => [
      key,
      value.replace(/\{slug\}/g, manifest.slug),
    ]),
  );
  const commandCenter = (manifest.layers || []).includes(COMMAND_CENTER_LAYER);

  const data = {
    ...names,
    appName: manifest.name,
    basePath: manifest.basePath,
    fields,
    titleField: fields[0],
    editableFields: fields.filter((field) => !field.readonly),
    columns: fields.filter((field) => field.inList),
    customActions: actions,
    catalogLabels,
    rowActions: options.actions,
    rowClick: options.rowClick,
    preset: LIST_PRESETS[options.list],
    endpoint: options.endpoint || `/${names.domain}/${names.entity}`,
    scoped,
    createDefaults,
    icon: options.icon,
    advanced: options.section === 'advanced',
    has: {
      secret: fields.some((field) => field.type === 'secret'),
      options: fields.some((field) => field.type === 'options'),
      boolean: fields.some((field) => field.type === 'boolean'),
      replace: actions.some((action) => action.kind === 'replace'),
      call: actions.some((action) => action.kind === 'call'),
      copy: actions.some((action) => action.kind === 'copy'),
      delete: options.actions.includes('delete'),
      quickActions:
        options.actions.includes('delete') || actions.some((action) => ['replace', 'call'].includes(action.kind)),
    },
    text: { singular: inlineOf(labels.singularEn), plural: inlineOf(labels.pluralEn), Plural: labels.pluralEn },
    json: (value) => JSON.stringify(value),
    list: (items) => `[${items.map((item) => JSON.stringify(item)).join(', ')}]`,
    object: (value) => {
      const entries = Object.entries(value).map(([key, item]) => `${key}: ${JSON.stringify(item)}`);
      return entries.length ? `{ ${entries.join(', ')} }` : '{}';
    },
  };

  const replacing = options.replace && files.exists(entityDir);
  if (replacing) {
    removeEntity(files, names);
  }

  renderInto(files, [FILES_DIR, SERVICE_FILES_DIR, ...(commandCenter ? [COMMAND_CENTER_FILES_DIR] : [])], data);

  addCopy(files, { names, labels, fields, actions, catalogLabels, replace: replacing });
  addIcon(files, options.icon);
  if (navigation) {
    addNavigation(files, { names, icon: options.icon });
  }

  if (omnisearch) {
    addOmnisearchCategory(files, { names, icon: options.icon, rowClick: options.rowClick, titleField: fields[0].name });
  }

  if (options.quickAdd) {
    addQuickAdd(files, { names, icon: options.icon });
  }

  recordEntity(files, manifest, {
    domain: names.domain,
    entity: names.entity,
    plural: names.plural,
    path: names.listPath,
    list: options.list,
    actions: options.actions,
    customActions: actions.map((action) => action.id),
    scope: options.scope,
  });

  const pendingSpanish = missingSpanish({ options, fields, actions });
  const warnings = [
    ...(pendingSpanish.length ? [`Spanish copy fell back to English for: ${pendingSpanish.join(', ')}`] : []),
  ];

  return {
    warnings,
    project: { entity: { domain: names.domain, entity: names.entity, path: names.listPath } },
    next: ['npm run verify'],
  };
}
