import fs from 'node:fs';
import path from 'node:path';

import {
  ERROR_CODES,
  LoomError,
  VirtualTree,
  applyTree,
  importGenerator,
  loadCollection,
  parseSource,
  readGeneratorSchema,
  validateOptions,
  walkAst,
} from '@link-loom/devkit';
import { addCopy, copyTreeAt, within } from '@link-loom/react-generators/src/generators/shared/project.js';
import { entityNames } from '@link-loom/react-generators/src/generators/entity/naming.js';

import { validateDecisions } from './decisions.js';
import { openRepo } from './source.js';
import { findTexts, readTextsFromCopy } from './texts.js';
import {
  namesRead,
  pruneUnused,
  rewriteImports,
  rewriteLinks,
  rewriteOutletContext,
  specifierOf,
} from './transform.js';
import { targetOf, testPathOf } from './targets.js';
import { kebabCase } from './naming.js';
import { mergeTheme } from './theme.js';
import { colorsToTokens, withLegacyColors } from './colors.js';

const COLLECTION_DIR = path.dirname(
  new URL(import.meta.resolve('@link-loom/react-generators/collection.json')).pathname,
);

const generatorOf = async (id) => {
  const generator = loadCollection(COLLECTION_DIR).generators[id];
  return { schema: readGeneratorSchema(generator), run: await importGenerator(generator) };
};

const exportsDefault = (source) => /\bexport\s+default\b/.test(source);

// What a sidebar row of the decisions passes on to `add nav-item`.
const NAV_FIELDS = [
  'id',
  'labelEn',
  'labelEs',
  'icon',
  'before',
  'sectionEn',
  'sectionEs',
  'group',
  'groupEn',
  'groupEs',
  'groupIcon',
];

/** One route module per carried-over page, the way `add page` writes them, under the app's base route. */
const routeModule = ({ name, target, paths }) => {
  const page = `${name}Page`;
  const routes = paths.map((routePath) => `<Route path="${routePath}" element={<${page} />} />`);
  const body =
    routes.length === 1
      ? `  return ${routes[0]};`
      : `  return (\n    <>\n      ${routes.join('\n      ')}\n    </>\n  );`;
  return `import { lazy } from "react";\nimport { Route } from "react-router-dom";\n\nconst ${page} = lazy(() => import("${specifierOf(target)}"));\n\nexport default function ${name}Routes() {\n${body}\n}\n`;
};

/** A first test for code that had none: it loads and exports what it says. Deeper tests are pending work. */
const smokeTest = (target, source) => {
  const exported =
    /export\s+default\s+(?:function|class)\s+(\w+)/.exec(source)?.[1] || /export\s+default\s+(\w+)/.exec(source)?.[1];
  const named = /export\s+(?:const|function|class)\s+(\w+)/.exec(source)?.[1];
  const subject = exported ? `${exported}` : named;
  const imported = exported
    ? `import ${exported} from "${specifierOf(target)}";`
    : `import { ${named} } from "${specifierOf(target)}";`;
  return subject
    ? `${imported}\n\n// Carried over by link-loom migrate: replace with tests of its behaviour.\ndescribe("${subject}", () => {\n  it("loads", () => {\n    expect(${subject}).toBeDefined();\n  });\n});\n`
    : `import * as module from "${specifierOf(target)}";\n\n// Carried over by link-loom migrate: replace with tests of its behaviour.\ndescribe("${path.basename(target)}", () => {\n  it("loads", () => {\n    expect(module).toBeDefined();\n  });\n});\n`;
};

const relativePath = (basePath, routePath) => routePath.replace(new RegExp(`^${basePath}/?`), '') || '/';

/**
 * Builds the new project from a legacy app and its finished decisions, in a new folder; the legacy repo is only read.
 * It creates the webapp (`create webapp` with the project decisions), carries every file decided `move` to its place
 * with its texts read from the dictionaries, its imports pointed at the new layout and the legacy outlet context
 * replaced, mounts the pages on their routes, adds the sidebar rows, merges the legacy theme, copies the public files
 * the code uses, writes a first test for each carried file, and returns what is left for a person or an agent. A dry
 * run answers the same plan and writes nothing.
 */
export const applyMigration = async ({ decisions, outDir, dryRun = false }) => {
  validateDecisions(decisions);
  const repo = openRepo(decisions.source);
  const target = path.resolve(outDir);
  if (fs.existsSync(target) && fs.readdirSync(target).some((entry) => !entry.startsWith('.'))) {
    throw new LoomError(ERROR_CODES.targetExists, `The target folder is not empty: ${outDir}`, { path: outDir });
  }

  if (!dryRun) fs.mkdirSync(target, { recursive: true });
  const tree = new VirtualTree({ root: target });
  const webapp = await generatorOf('webapp');
  const project = validateOptions(webapp.schema, { ...decisions.project, directory: '.' });
  const created = await webapp.run(tree, project);
  const files = within(tree, '');
  const pending = [];

  // Entities rebuilt with the kit (`add entity`), in place of the legacy lists and records decided `discard`. When a
  // legacy sidebar row opens the entity's list, that row keeps its place and the entity adds no row of its own.
  const entity = await generatorOf('entity');
  const basePath = JSON.parse(tree.read('loom.json', 'utf8')).basePath;
  const rowPaths = new Set(
    (decisions.navigation || [])
      .filter((row) => row.labelEn && !row.skip)
      .map((row) => `/${relativePath(basePath, row.to).replace(/^\//, '')}`),
  );
  for (const input of decisions.entities || []) {
    const options = validateOptions(entity.schema, input);
    const listed = rowPaths.has(entityNames(options).listPath);
    await entity.run(tree, listed ? { ...options, navigation: false } : options, {
      project: JSON.parse(tree.read('loom.json', 'utf8')),
      directory: '',
    });
  }

  // Where every carried file goes, and which barrels map names to files.
  const moved = decisions.files.filter((decision) => decision.action === 'move');
  const targets = new Map(moved.map((decision) => [decision.file, targetOf(decision, repo.read(decision.file))]));
  const legacyOf = new Map([...targets].map(([from, to]) => [to, from]));
  const taken = [...targets.values()].filter((file, index, list) => list.indexOf(file) !== index);
  const collisions = [...targets.entries()].filter(
    ([, file]) => file !== 'src/constants/theme.js' && tree.exists(file),
  );
  if (taken.length || collisions.length) {
    throw new LoomError(
      ERROR_CODES.validation,
      'Two files would land in the same place, or on a file the new project already has',
      {
        problems: [
          ...taken.map((file) => ({ field: 'files', message: `two decisions write ${file}: give one another name` })),
          ...collisions.map(([from, file]) => ({
            field: 'files',
            message: `${from} would replace ${file} of the new project: give it another ${
              file.startsWith('src/services/') ? '`entity`' : '`name`'
            } in its decision, or discard it`,
          })),
        ],
      },
    );
  }

  // What a barrel (an index.js the migration leaves behind) exports, by name: the file that defines each.
  const barrelOf = (barrel) => {
    const program = repo.ast(barrel)?.program.body || [];
    const lazy = {};
    const imported = {};
    for (const statement of program) {
      if (statement.type === 'ImportDeclaration') {
        statement.specifiers.forEach(
          (specifier) => (imported[specifier.local.name] = repo.resolve(barrel, statement.source.value)),
        );
      }

      walkAst(statement, (node) => {
        if (node.type !== 'VariableDeclarator') return;
        walkAst(node.init, (inner) => {
          if (
            inner.type === 'CallExpression' &&
            inner.callee.type === 'Import' &&
            inner.arguments[0]?.type === 'StringLiteral'
          ) {
            lazy[node.id.name] = repo.resolve(barrel, inner.arguments[0].value);
          }
        });
      });
    }

    const names = { ...lazy };
    for (const statement of program.filter((item) => item.type === 'ExportNamedDeclaration')) {
      for (const specifier of statement.specifiers || []) {
        const local = specifier.local?.name;
        names[specifier.exported.name] = statement.source
          ? repo.resolve(barrel, statement.source.value)
          : (imported[local] ?? lazy[local] ?? names[specifier.exported.name]);
      }
    }

    return names;
  };

  const resolverFor = (file) => (specifier) => {
    const resolved = repo.resolve(file, specifier);
    if (!resolved) return undefined;
    if (targets.has(resolved)) return targets.get(resolved);
    const discarded = decisions.files.find((decision) => decision.file === resolved);
    if (/\/index\.jsx?$/.test(resolved) && discarded?.action === 'discard') {
      return Object.fromEntries(
        Object.entries(barrelOf(resolved))
          .map(([name, defining]) => [name, targets.get(defining)])
          .filter(([, moved]) => moved),
      );
    }

    return null;
  };

  // Texts: only the ones with a key and both languages are moved into the dictionaries.
  const textsByFile = new Map();
  for (const text of decisions.texts || []) {
    if (!text.key || !text.en || !text.es) continue;
    if (!textsByFile.has(text.file)) textsByFile.set(text.file, {});
    textsByFile.get(text.file)[text.start] = text;
  }

  let movedTexts = 0;

  const leftTexts = (decisions.texts || []).filter(
    (text) => targets.has(text.file) && !(text.key && text.en && text.es),
  );
  if (leftTexts.length)
    pending.push(
      `${leftTexts.length} texts still written in components (no key or no Spanish): \`link-loom check\` lists them`,
    );

  const legacyColors = {};
  const broken = [];
  for (const decision of moved) {
    const to = targets.get(decision.file);
    let source = repo.read(decision.file);
    const decided = textsByFile.get(decision.file) || {};
    const found = new Set(findTexts(source, decision.file).map((text) => String(text.start)));
    pending.push(
      ...Object.entries(decided)
        .filter(([start]) => !found.has(start))
        .map(
          ([start, text]) =>
            `${decision.file}: no text at offset ${start} ("${text.text}"); only the texts analyze lists move into the dictionaries`,
        ),
    );
    const read = readTextsFromCopy(
      source,
      Object.fromEntries(Object.entries(decided).map(([start, text]) => [start, text.key])),
      { file: decision.file },
    );
    source = read.source;
    for (const start of read.rewritten) {
      addCopy(files, copyTreeAt(decided[start].key, { en: decided[start].en, es: decided[start].es }));
    }
    movedTexts += read.rewritten.length;
    pending.push(
      ...read.left.map(
        (text) =>
          `${decision.file}:${text.line}: "${text.text}" is outside every function, or in one with a \`copy\` of its own; it stays written in the code`,
      ),
    );
    const outlet = rewriteOutletContext(source, decision.file);
    const imports = rewriteImports(outlet.source, decision.file, {
      targetOf: resolverFor(decision.file),
      exportsDefault: (file) => exportsDefault(repo.read(legacyOf.get(file))),
    });
    pending.push(...outlet.notes, ...imports.notes);

    if (to === 'src/constants/theme.js') {
      const merged = mergeTheme(files.read(to, 'utf8'), imports.source);
      files.overwrite(to, merged.source);
      pending.push(...merged.notes);
      continue;
    }

    const linked = rewriteLinks(imports.source, decision.file, decisions.links);
    const pruned = pruneUnused(linked, decision.file);
    const unresolved = namesRead(
      pruned,
      decision.file,
      imports.missing.map((entry) => entry.name),
    );
    broken.push(
      ...imports.missing
        .filter((entry) => unresolved.includes(entry.name))
        .map((entry) => ({
          field: 'files',
          message: `${decision.file} uses ${entry.name} from ${entry.from}, which is not carried over: move the file that defines it, or discard ${decision.file}`,
        })),
    );
    const colored = colorsToTokens(pruned, to);
    Object.assign(legacyColors, colored.colors);
    files.create(to, colored.source);
    const test = testPathOf(to);
    if (test && !files.exists(test)) files.create(test, smokeTest(to, colored.source));
  }

  if (broken.length) {
    throw new LoomError(ERROR_CODES.validation, 'Carried code uses names whose files are not carried over', {
      problems: broken,
    });
  }

  if (Object.keys(legacyColors).length) {
    files.overwrite(
      'src/constants/theme.js',
      withLegacyColors(files.read('src/constants/theme.js', 'utf8'), legacyColors),
    );
    pending.push(
      `${Object.keys(legacyColors).length} colours the legacy code used outside its theme are in LEGACY_COLORS (src/constants/theme.js): fold them into the palette`,
    );
  }

  // Packages the carried code imports that the new project lacks, at the version the legacy app had installed.
  const legacyPackage = JSON.parse(fs.readFileSync(path.join(decisions.source, 'package.json'), 'utf8'));
  const lockFile = path.join(decisions.source, 'package-lock.json');
  const installed = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, 'utf8')).packages || {} : {};
  const legacyVersions = { ...legacyPackage.devDependencies, ...legacyPackage.dependencies };
  const versionOf = (name) => installed[`node_modules/${name}`]?.version || legacyVersions[name];
  const packageJson = JSON.parse(files.read('package.json', 'utf8'));
  const present = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const packageOf = (specifier) =>
    specifier
      .split('/')
      .slice(0, specifier.startsWith('@') ? 2 : 1)
      .join('/');
  const imported = new Set(
    [...targets.values()]
      .filter((file) => files.exists(file) && /\.jsx?$/.test(file))
      .flatMap((file) => {
        const specifiers = [];
        walkAst(parseSource(files.read(file, 'utf8'), file), (node) => {
          if (node.type === 'ImportDeclaration') specifiers.push(node.source.value);
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Import' &&
            node.arguments[0]?.type === 'StringLiteral'
          ) {
            specifiers.push(node.arguments[0].value);
          }
        });
        return specifiers;
      })
      .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('node:'))
      .map(packageOf)
      .filter(
        (name) =>
          !/^@(components|pages|layouts|routes|services|hooks|constants|i18n|utils|app-config)$/.test(
            name.split('/')[0],
          ),
      ),
  );
  const added = [...imported].filter((name) => !present[name] && versionOf(name)).sort();
  if (added.length) {
    packageJson.dependencies = Object.fromEntries(
      Object.entries({
        ...packageJson.dependencies,
        ...Object.fromEntries(added.map((name) => [name, versionOf(name)])),
      }).sort(([left], [right]) => left.localeCompare(right)),
    );
    files.overwrite('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
    pending.push(
      `The carried code imports ${added.join(', ')}, added at the versions the legacy app had installed: move it to the kit where it can`,
    );
  }

  const unknown = [...imported].filter((name) => !present[name] && !versionOf(name));
  if (unknown.length) pending.push(`The carried code imports ${unknown.join(', ')}, which neither app declares`);

  // Routes: one module per page, its paths relative to the app's base route.
  const manifest = JSON.parse(tree.read('loom.json', 'utf8'));
  const pages = moved.filter((decision) => decision.kind === 'page');
  for (const page of pages) {
    const paths = (decisions.routes || [])
      .filter((route) => route.file === page.file)
      .map((route) => relativePath(basePath, route.path));
    if (!paths.length) {
      pending.push(`${page.file}: no route renders it; it was carried over without one`);
      continue;
    }

    const pageTarget = targets.get(page.file);
    const name = path.basename(pageTarget, '.page.jsx');
    files.create(
      `src/routes/domains/${page.domain}/${kebabCase(name)}.routes.jsx`,
      routeModule({ name, target: pageTarget, paths }),
    );
  }

  // Sidebar rows, after the pages they open.
  const navItem = await generatorOf('nav-item');
  // The new sidebar already titles Advanced settings "Settings": a legacy row under the same title joins it at the end.
  const settingsTitle = /groups:\s*\{[^}]*?settings:\s*"([^"]+)"/.exec(files.read('src/i18n/en.js', 'utf8'))?.[1];
  for (const row of decisions.navigation || []) {
    if (!row.labelEn || row.skip) continue;
    const to = `/${relativePath(basePath, row.to).replace(/^\//, '')}`;
    const joinsSettings = !row.group && settingsTitle && row.sectionEn?.toLowerCase() === settingsTitle.toLowerCase();
    const fields = joinsSettings ? NAV_FIELDS.filter((field) => !field.startsWith('section')) : NAV_FIELDS;
    const given = {
      ...Object.fromEntries(fields.filter((field) => row[field]).map((field) => [field, row[field]])),
      ...(joinsSettings ? { last: true } : {}),
    };
    await navItem.run(
      tree,
      validateOptions(navItem.schema, { id: to.split('/').filter(Boolean).join('-') || 'home', ...given, to }),
      { project: manifest, directory: '' },
    );
    if (!row.labelEs) pending.push(`Sidebar row ${to}: no Spanish label`);
  }

  // Public files the code uses, at the same address.
  for (const asset of decisions.assets || []) {
    if (!asset.keep) continue;
    const source = path.join(decisions.source, 'public', asset.path);
    if (fs.existsSync(source) && !files.exists(`public${asset.path}`))
      files.create(`public${asset.path}`, fs.readFileSync(source));
  }

  const report = [
    `# Migration of ${decisions.project.name}`,
    '',
    `From \`${decisions.source}\`, by \`link-loom migrate apply\`. The legacy repo was only read.`,
    '',
    `- Rebuilt with the kit: ${(decisions.entities || []).map((input) => `${input.domain}/${input.entity}`).join(', ') || 'no entity'}.`,
    `- Carried over: ${moved.length} files (${pages.length} pages), ${(decisions.navigation || []).filter((row) => row.labelEn && !row.skip).length} sidebar rows, ${movedTexts} texts into the dictionaries.`,
    `- Left behind: ${decisions.files.filter((decision) => decision.action === 'discard').length} files (the old shell, barrels and dead code).`,
    '',
    '## Pending',
    '',
    ...(pending.length ? pending.map((item) => `- ${item}`) : ['- Nothing.']),
    '',
    'Next: `npm install`, `npx link-loom migrate finish` (formats the carried files and lists the lint they still fail), `npm run verify`; `npx link-loom check --json` lists every rule still failing.',
    '',
  ].join('\n');
  files.create('MIGRATION.md', report);
  const carried = [...targets.values()].filter((file) => file !== 'src/constants/theme.js');
  const testsOf = carried.map(testPathOf).filter((test) => test && files.exists(test));
  files.overwrite(
    'loom.json',
    `${JSON.stringify({ ...JSON.parse(files.read('loom.json', 'utf8')), migration: { from: path.basename(decisions.source), carried: [...carried, ...testsOf].sort() } }, null, 2)}\n`,
  );

  if (!dryRun) applyTree(tree);
  return { project: created.project, pending, report, plan: tree.plan() };
};
