import fs from 'node:fs';
import path from 'node:path';

import { walkAst } from '@link-loom/devkit';

import { ICON_CATALOG } from '@link-loom/react-generators/src/generators/shared/project.js';

import { findTexts } from './texts.js';
import { openRepo, reachableFrom } from './source.js';
import { camelCase, kebabCase, pascalCase, withoutPrefix } from './naming.js';

const SHELL = /^src\/(layouts\/|components\/layouts\/)/;
const ENTRY_CANDIDATES = ['src/main.jsx', 'src/main.js', 'src/index.jsx', 'src/index.js'];
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

const jsxName = (node) => node?.openingElement?.name?.name;
const attribute = (element, name) => element.openingElement.attributes.find((item) => item.name?.name === name);
const stringOf = (value) =>
  value?.type === 'StringLiteral'
    ? value.value
    : value?.expression?.type === 'StringLiteral'
      ? value.expression.value
      : undefined;
const joinPath = (parent, child) => (child.startsWith('/') ? child : `${parent.replace(/\/$/, '')}/${child}`);

/** Where a component name used in a file comes from: its import, through barrels and `lazy(() => import(…))`. */
const definitionOf = (repo, file, name, depth = 0) => {
  if (depth > 4) return null;
  for (const entry of repo.importsOf(file)) {
    const specifiers = entry.node.specifiers || [];
    const local = specifiers.find((item) => item.local?.name === name || item.exported?.name === name);
    if (!local || !entry.target) continue;
    const imported = local.imported?.name ?? local.local?.name ?? name;
    if (local.type === 'ImportDefaultSpecifier') return entry.target;
    return definitionOf(repo, entry.target, imported, depth + 1) || entry.target;
  }

  // A barrel: `const X = lazy(() => import('./a/X'))` (exported below), or `export { default as X } from './X'`.
  let found = null;
  walkAst(repo.ast(file), (node) => {
    if (found || node.type !== 'VariableDeclarator' || node.id?.name !== name) return;
    walkAst(node.init, (inner) => {
      if (
        !found &&
        inner.type === 'CallExpression' &&
        inner.callee.type === 'Import' &&
        inner.arguments[0]?.type === 'StringLiteral'
      ) {
        found = repo.resolve(file, inner.arguments[0].value);
      }
    });
  });
  return found;
};

/** The route tree of the file that holds `<Routes>`, flattened to full paths with the file each one renders. */
const routesOf = (repo) => {
  const appFile = repo.sources.find((file) => /<Routes\b/.test(repo.read(file)));
  if (!appFile) return { appFile: null, routes: [] };
  const routes = [];
  const visit = (node, parentPath, layout) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXElement' && jsxName(node) === 'Route') {
      const routePath = stringOf(attribute(node, 'path')?.value);
      const isIndex = Boolean(attribute(node, 'index'));
      const fullPath = routePath === undefined ? parentPath : joinPath(parentPath, routePath);
      const element = attribute(node, 'element')?.value?.expression;
      const component = jsxName(element);
      const file = component ? definitionOf(repo, appFile, component) : null;
      const isLayout = node.children.some((child) => child.type === 'JSXElement');
      if (component && !isLayout && component !== 'Navigate') {
        const finalPath = isIndex ? parentPath : fullPath;
        routes.push({
          path: finalPath,
          component,
          file,
          layout,
          ...(routePath === undefined && !isIndex ? { unreachable: true } : {}),
          ...(finalPath.includes('*') ? { catchAll: true } : {}),
        });
      }

      node.children.forEach((child) => visit(child, fullPath, isLayout && component ? component : layout));
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      (Array.isArray(value) ? value : [value]).forEach(
        (child) => child && typeof child === 'object' && visit(child, parentPath, layout),
      );
    }
  };
  visit(repo.ast(appFile)?.program, '', null);
  return { appFile, routes };
};

/** Classes of src/services: their endpoints (string literals that look like paths) and the env vars they read. */
const servicesOf = (repo, reachable) =>
  repo.sources
    .filter((file) => file.startsWith('src/services/') && !/\/index\.jsx?$/.test(file))
    .map((file) => {
      const source = repo.read(file);
      const className = /export\s+(?:default\s+)?class\s+(\w+)/.exec(source)?.[1];
      return {
        file,
        className,
        base: /extends\s+(\w+)/.exec(source)?.[1] || null,
        endpoints: [...new Set([...source.matchAll(/['"`](\/[a-z][\w/-]*)['"`]/g)].map((match) => match[1]))],
        env: [...new Set([...source.matchAll(/import\.meta\.env\.(\w+)/g)].map((match) => match[1]))],
        used:
          reachable.has(file) &&
          repo.sources.some(
            (other) => other !== file && className && new RegExp(`new\\s+${className}\\b`).test(repo.read(other)),
          ),
      };
    })
    .filter((service) => service.className);

const PATH_LITERAL = /^\/[a-z][\w/-]*([?#][\w=&#-]*)?$/;

/** The first app path a node holds anywhere inside it: `to="/x"`, `navigate('/x')`, `path: '/x'`. */
const pathInside = (node) => {
  let found;
  walkAst(node, (inner) => {
    if (!found && inner.type === 'StringLiteral' && PATH_LITERAL.test(inner.value)) found = inner.value;
  });
  return found;
};

const textOf = (value) => stringOf(value) ?? (value?.type === 'StringLiteral' ? value.value : undefined);

/** The string `NAME.key` holds when NAME is an object literal exported by a file this one imports. */
const constantOf = (repo, file, value) => {
  if (value?.type !== 'MemberExpression' || value.computed || value.object?.type !== 'Identifier') return undefined;
  const entry = repo
    .importsOf(file)
    .find((item) => item.target && (item.node.specifiers || []).some((spec) => spec.local?.name === value.object.name));
  if (!entry) return undefined;
  const exported = (entry.node.specifiers || []).find((spec) => spec.local?.name === value.object.name);
  const name = exported.imported?.name ?? value.object.name;
  let found;
  walkAst(repo.ast(entry.target), (node) => {
    if (found !== undefined || node.type !== 'VariableDeclarator' || node.id?.name !== name) return;
    const property = node.init?.properties?.find((item) => (item.key?.name ?? item.key?.value) === value.property.name);
    found = textOf(property?.value);
  });
  return found;
};

// Legacy MUI icons that the kit's catalog has, by component name without its style suffix.
const ICON_BY_NAME = {
  ...Object.fromEntries(
    Object.entries(ICON_CATALOG).map(([key, component]) => [
      component.replace(/(Outlined|Outline|Rounded|Sharp|TwoTone)$/, ''),
      key,
    ]),
  ),
  // Close cousins of the catalog's icons.
  Dashboard: 'dashboard',
  Inventory: 'inventory',
  Group: 'people',
  Person: 'people',
  Settings: 'settings',
  Business: 'building',
  Description: 'document',
  Event: 'calendar',
  BarChart: 'chart',
  Assessment: 'analytics',
};

/** Local names of a file that are MUI icons, by the icon they render (`styled(Icon)` wrappers included). */
const iconNamesOf = (repo, file) => {
  const names = {};
  for (const statement of repo.ast(file)?.program.body || []) {
    if (statement.type !== 'ImportDeclaration' || !statement.source.value.startsWith('@mui/icons-material')) continue;
    for (const specifier of statement.specifiers) {
      names[specifier.local.name] =
        specifier.type === 'ImportDefaultSpecifier' ? statement.source.value.split('/').pop() : specifier.imported.name;
    }
  }

  walkAst(repo.ast(file), (node) => {
    const wrapped = node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression' && node.init.callee;
    const inner =
      wrapped?.type === 'CallExpression' && wrapped.callee?.name === 'styled' ? wrapped.arguments[0]?.name : null;
    if (inner && names[inner]) names[node.id.name] = names[inner];
  });
  return names;
};

const iconKeyOf = (element, iconNames) => {
  const component = iconNames[jsxName(element)];
  return component ? ICON_BY_NAME[component.replace(/(Outlined|Outline|Rounded|Sharp|TwoTone)$/, '')] || '' : '';
};

const firstText = (element) =>
  element.children
    .filter((child) => child.type === 'JSXText')
    .map((child) => child.value.trim())
    .find(Boolean);

/**
 * Sidebar rows of the shell, in the order the sidebar renders its parts: JSX rows with a title and a path (as a link,
 * or navigated to on click), and the items of grouped rows (`{ label, path }` objects). Each with the path it opens,
 * its label and icon, the section title printed above its part and the group it belongs to.
 */
const navigationOf = (repo) => {
  const files = repo.sources.filter((file) => /sidebar|navigation/i.test(file));
  const nameOf = (file) => path.basename(file).replace(/\.(component\.)?jsx?$/, '');
  const order = (file) =>
    Math.min(
      ...files.map((other) => repo.read(other).indexOf(`<${nameOf(file)}`)).filter((index) => index !== -1),
      Number.MAX_SAFE_INTEGER,
    );
  return files
    .map((file, index) => ({ file, index, at: order(file) }))
    .sort((left, right) => left.at - right.at || left.index - right.index)
    .flatMap(({ file }) => {
      const iconNames = iconNamesOf(repo, file);
      const rows = [];
      let section;
      let group;
      walkAst(repo.ast(file), (node) => {
        if (node.type !== 'JSXElement') return;
        const className = stringOf(attribute(node, 'className')?.value) || '';
        if (!section && /\bmenu-title\b/.test(className)) section = firstText(node);
        if (!group && /SidebarGroup/.test(jsxName(node) || '')) {
          const label = stringOf(attribute(node, 'title')?.value);
          if (label)
            group = {
              id: kebabCase(label),
              label,
              icon: iconKeyOf(attribute(node, 'icon')?.value?.expression, iconNames),
            };
        }
      });
      walkAst(repo.ast(file), (node) => {
        if (node.type === 'JSXElement') {
          const label = ['title', 'label'].map((name) => stringOf(attribute(node, name)?.value)).find(Boolean);
          const to = label && node.openingElement.attributes.map((item) => pathInside(item.value)).find(Boolean);
          const icon = iconKeyOf(attribute(node, 'icon')?.value?.expression, iconNames);
          if (label && to) rows.push({ file, to, label, icon });
          return;
        }

        if (node.type === 'ObjectExpression') {
          const field = (names) =>
            node.properties.find((property) => names.includes(property.key?.name ?? property.key?.value))?.value;
          const label = textOf(field(['title', 'label', 'name']));
          const target = field(['path', 'to', 'href', 'route']);
          const to = textOf(target) ?? constantOf(repo, file, target);
          if (label && to && PATH_LITERAL.test(to)) {
            rows.push({ file, to, label, icon: iconKeyOf(field(['icon']), iconNames), ...(group ? { group } : {}) });
          }
        }
      });
      // The section title prints above the first part of the file: its group, or its first row.
      return rows.map((row, index) => (index === 0 && section ? { ...row, section } : row));
    })
    .filter((row, index, rows) => rows.findIndex((other) => other.to === row.to) === index);
};

/** The brand the legacy app paints with: the hex values of constants/theme.js by their key. */
const brandOf = (repo) => {
  const themeFile = repo.sources.find((file) => /constants\/theme\.js$/.test(file));
  if (!themeFile) return {};
  const colors = Object.fromEntries(
    [...repo.read(themeFile).matchAll(/(\w+)\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/g)].map(([, key, value]) => [
      key,
      value.toLowerCase(),
    ]),
  );
  const primary = colors.brandPrimary || colors.primary || Object.values(colors)[0];
  return { file: themeFile, colors, primaryColor: primary, headerColor: colors.header || primary };
};

const VENDOR = /^\/assets\/(css|js|libs|fonts)\//;

/** Public files the carried code names (`/assets/…` in src), and whether each exists; the old shell's vendor files are not among them. */
const assetsOf = (repo) => {
  const named = new Set(
    repo.sources
      .filter((file) => !SHELL.test(file))
      .flatMap((file) =>
        [...repo.read(file).matchAll(/['"`(](\/(?:assets|images|img|brand)\/[^'"`)\s?#]+)/g)].map((match) => match[1]),
      )
      .filter((asset) => !VENDOR.test(asset)),
  );
  return [...named]
    .sort()
    .map((asset) => ({ path: asset, exists: fs.existsSync(path.join(repo.root, 'public', asset)) }));
};

const roleOf = (file, source) => {
  if (file.startsWith('src/components/shared/')) return 'shared';
  if (!/<[A-Za-z]/.test(source) && !/\.jsx$/.test(file)) return 'utils';
  const name = path.basename(file).replace(/\.(component\.)?jsx?$/, '');
  if (/List/.test(name)) return 'list';
  if (/(Detail|Record|View)$/.test(name)) return 'record';
  return 'component';
};

/** A dictionary key for a text: its first words in camelCase, always starting with a letter. */
const keyOfText = (text, index) => {
  const words = camelCase(text.split(/\s+/).slice(0, 4).join(' '));
  if (!words) return `text${index}`;
  return /^[a-z]/.test(words) ? words : `text${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/** The first segment after the app's base path: /admin/item/management → item. */
const domainOfPath = (routePath) =>
  routePath.split('/').filter((segment) => segment && !segment.startsWith(':'))[1] || 'app';

/**
 * Reads a legacy webapp and answers what the migration needs to decide: every route with the page it renders, every
 * file the app runs with a proposed place in the new layout (or discard, for the shell and dead code), services,
 * sidebar rows, the texts written in components, the brand, the public files the code uses and the env vars. Nothing
 * is written; the result is the inventory and a draft of migration.decisions.json for a person or an agent to finish.
 */
export const analyzeRepo = (root) => {
  const repo = openRepo(root);
  const entry = ENTRY_CANDIDATES.find((file) => repo.files.includes(file));
  const reachable = reachableFrom(repo, [entry].filter(Boolean));
  const { appFile, routes } = routesOf(repo);
  const pageFiles = new Set(routes.map((route) => route.file).filter(Boolean));
  const routed = new Set(routes.filter((route) => !route.unreachable).map((route) => route.file));
  const unrouted = new Set(
    routes.filter((route) => route.unreachable && !routed.has(route.file)).map((route) => route.file),
  );
  // Pages the generated app already has: sign-in and the rest of the auth flow, and maintenance.
  const builtIn = new Set(
    routes
      .filter(
        (route) => route.file && (/auth|maintenance/i.test(route.layout || '') || /maintenance/i.test(route.file)),
      )
      .map((route) => route.file),
  );
  const domainOfFile = new Map(
    routes.filter((route) => route.file).map((route) => [route.file, domainOfPath(route.path)]),
  );

  const files = repo.sources
    .filter((file) => file !== entry && file !== appFile)
    .map((file) => {
      const source = repo.read(file);
      const name = path.basename(file).replace(/\.(component\.)?jsx?$/, '');
      // The domain folder: src/pages/<folder>/… or src/components/pages/<folder>/…
      const folder =
        (file.startsWith('src/components/pages/') ? file.split('/')[3] : file.split('/').slice(2, -1)[0]) || '';
      const domain = domainOfFile.get(file) || kebabCase(folder.split('-')[0] || 'app');
      if (!reachable.has(file)) return { file, action: 'discard', reason: 'nothing imports it' };
      if (SHELL.test(file))
        return { file, action: 'discard', reason: 'shell: the frame comes from @link-loom/react-shell' };
      if (
        /\/index\.jsx?$/.test(file) &&
        /^\s*(import|export|const \w+ = lazy)/m.test(source) &&
        !/<[A-Za-z]/.test(source)
      ) {
        return { file, action: 'discard', reason: 'barrel: imports point at the files directly' };
      }

      if (unrouted.has(file)) {
        return { file, action: 'discard', reason: 'no route reaches it' };
      }

      if (builtIn.has(file)) {
        return {
          file,
          action: 'discard',
          reason: 'the new project has its own sign-in, account and maintenance pages',
        };
      }

      if (pageFiles.has(file))
        return { file, action: 'move', kind: 'page', domain, name: withoutPrefix(name.replace(/Page$/, ''), domain) };
      if (file.startsWith('src/services/')) {
        if (/class\s+BaseApi\b/.test(source))
          return { file, action: 'move', kind: 'service', base: true, entity: 'legacy-api' };
        const entity = kebabCase(name.replace(/\.service$|Service$/i, '')).replace(new RegExp(`^${domain}-`), '');
        return { file, action: 'move', kind: 'service', domain, entity };
      }
      if (file.startsWith('src/hooks/'))
        return {
          file,
          action: 'move',
          kind: 'hook',
          name: pascalCase(name)
            .replace(/^Use/, 'use')
            .replace(/\.hook$/, ''),
        };
      if (file.startsWith('src/constants/')) return { file, action: 'move', kind: 'constants', name: kebabCase(name) };
      const role = roleOf(file, source);
      return {
        file,
        action: 'move',
        kind: 'component',
        role,
        domain,
        entity: kebabCase(withoutPrefix(name, domain).replace(/(List\w*|Detail|Record|View)$/, '')) || domain,
        name,
      };
    });

  // One key per text: the same words share a key, different words that would make the same key get a number.
  const textOfKey = new Map();
  const uniqueKey = (base, text) => {
    let key = base;
    for (let suffix = 2; textOfKey.has(key) && textOfKey.get(key) !== text; suffix += 1) key = `${base}${suffix}`;
    textOfKey.set(key, text);
    return key;
  };
  const texts = repo.sources
    .filter(
      (file) =>
        reachable.has(file) &&
        !SHELL.test(file) &&
        !file.endsWith('.sommatic.jsx') &&
        (/\.jsx$/.test(file) || /^src\/(components|pages|hooks|constants)\/.*\.js$/.test(file)),
    )
    .flatMap((file) => {
      const plan = files.find((entryPlan) => entryPlan.file === file);
      const scope = `${camelCase(plan?.domain || 'app')}.${camelCase(plan?.name || path.basename(file).replace(/\.jsx?$/, ''))}`;
      return findTexts(repo.read(file), file).map((text, index) => ({
        file,
        start: text.start,
        line: text.line,
        text: text.text,
        key: uniqueKey(`${scope}.${keyOfText(text.text, index)}`, text.text),
        en: text.text,
        es: '',
      }));
    });

  const env = [
    ...new Set(
      repo.sources.flatMap((file) =>
        [...repo.read(file).matchAll(/import\.meta\.env\.(\w+)/g)].map((match) => match[1]),
      ),
    ),
  ].sort();
  const brand = brandOf(repo);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const dependencies = Object.keys({ ...packageJson.dependencies });
  const variant = routes.some((route) => route.path.startsWith('/admin')) ? 'admin' : 'client';

  return {
    inventory: {
      root,
      entry,
      appFile,
      routes,
      services: servicesOf(repo, reachable),
      navigation: navigationOf(repo),
      brand,
      assets: assetsOf(repo),
      env,
      counts: {
        sources: repo.sources.length,
        reachable: reachable.size,
        discard: files.filter((file) => file.action === 'discard').length,
        texts: texts.length,
        hexOutsideTheme: repo.sources.filter((file) => file !== brand.file && HEX.test(repo.read(file))).length,
      },
    },
    decisions: {
      $schema: 'link-loom/migrate/decisions (npx link-loom schema migration)',
      source: root,
      project: {
        name: packageJson.name,
        slug: kebabCase(packageJson.name),
        variant,
        description: packageJson.description || '',
        descriptionEs: '',
        defaultLocale: 'es',
        signup: false,
        stoneos: dependencies.includes('@link-loom/cloud-sdk'),
        commandCenter: dependencies.includes('@sommatic/react-sdk'),
        ...(brand.primaryColor ? { primaryColor: brand.primaryColor, headerColor: brand.headerColor } : {}),
      },
      routes: routes
        .filter((route) => route.file && !route.unreachable && !route.catchAll)
        .map(({ path: routePath, file, layout }) => ({ path: routePath, file, layout })),
      // Entities to rebuild with the kit: `add entity` inputs (npx link-loom schema entity). Their legacy lists and
      // records are then decided `discard`.
      entities: [],
      files,
      navigation: navigationOf(repo).map((row) => ({
        id: kebabCase(row.label) || kebabCase(row.to),
        to: row.to,
        labelEn: row.label || '',
        labelEs: '',
        icon: row.icon,
        ...(row.section ? { sectionEn: row.section, sectionEs: '' } : {}),
        ...(row.group
          ? { group: row.group.id, groupEn: row.group.label, groupEs: '', groupIcon: row.group.icon || 'folder' }
          : {}),
      })),
      texts,
      // Legacy app paths written in the code → their place in the new project. `migrate finish` lists the links that
      // still lead nowhere; add them here and apply again.
      links: Object.fromEntries(
        routes
          .filter((route) => /\/account(\/|$)/.test(route.path) && route.path !== `/${variant}/account/profile`)
          .map((route) => [route.path, `/${variant}/account/profile`]),
      ),
      assets: assetsOf(repo)
        .filter((asset) => asset.exists)
        .map((asset) => ({ path: asset.path, keep: true })),
    },
  };
};
