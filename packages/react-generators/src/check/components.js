import { CHECK_SEVERITIES, importSources, importsFrom, walkAst } from '@link-loom/devkit';

import { JSX_SOURCE, isSource, lineOf } from './files.js';

const DOMAIN_COMPONENT = /^src\/components\/pages\/.*\.jsx$/;

/** Problems for every named import of `names` from `source` in the targets matching `scope`. */
const forbiddenImports = (project, { scope, source, names, message }) =>
  project.targets
    .filter((file) => scope.test(file))
    .flatMap((file) => {
      const ast = project.ast(file);
      return importsFrom(ast, source)
        .named.filter((name) => names.includes(name))
        .map((name) => ({ file, message: message(name) }));
    });

export const recordRule = {
  id: 'record',
  severity: CHECK_SEVERITIES.error,
  summary: 'Records and lists come from the kit: no hand-made dialogs, tables or detail/form pairs',
  run: (project) => [
    ...forbiddenImports(project, {
      scope: DOMAIN_COMPONENT,
      source: '@mui/material',
      names: ['Dialog', 'Table', 'TableBody', 'TableRow', 'TableCell', 'TableHead'],
      message: (name) =>
        `${name} from @mui/material: a record is EntityRecordDialog and a list is ListSurface (npx link-loom add entity)`,
    }),
    ...forbiddenImports(project, {
      scope: DOMAIN_COMPONENT,
      source: '@link-loom/react-sdk',
      names: ['FormDialog'],
      message: () => 'FormDialog creates a record outside of it: creating is the record before it exists',
    }),
    ...project.targets
      .filter((file) => DOMAIN_COMPONENT.test(file))
      .flatMap((file) => [
        ...importSources(project.ast(file))
          .filter((entry) => entry.source.startsWith('@mui/x-data-grid'))
          .map((entry) => ({ file, line: entry.line, message: 'A hand-made grid: lists use ListSurface' })),
        ...(/\brender(Detail|Form)=/.test(project.read(file))
          ? [{ file, message: 'renderDetail/renderForm split the record: one renderRecord reads and edits' }]
          : []),
      ]),
  ],
};

export const noSelectRule = {
  id: 'no-select',
  severity: CHECK_SEVERITIES.error,
  summary: 'Lists in forms are autocompletes (OptionsField, RemoteOptionsField), never a Select',
  run: (project) =>
    project.targets.filter(JSX_SOURCE.test.bind(JSX_SOURCE)).flatMap((file) => {
      const ast = project.ast(file);
      const problems = importsFrom(ast, '@mui/material')
        .named.filter((name) => name === 'Select' || name === 'NativeSelect')
        .map((name) => ({
          file,
          message: `${name}: use OptionsField or RemoteOptionsField from @link-loom/react-sdk`,
        }));
      walkAst(ast, (node) => {
        if (node.type === 'JSXAttribute' && node.name?.name === 'select' && node.value === null) {
          problems.push({ file, line: lineOf(node), message: 'TextField select: use OptionsField' });
        }
      });
      return problems;
    }),
};

export const gridRule = {
  id: 'bootstrap-grid',
  severity: CHECK_SEVERITIES.error,
  summary: 'Layout uses the Bootstrap 5.3 grid: never MUI Grid, never Tailwind',
  run: (project) => [
    ...project.targets.filter(isSource).flatMap((file) => [
      ...importsFrom(project.ast(file), '@mui/material')
        .named.filter((name) => /^(Unstable_)?Grid2?$/.test(name))
        .map((name) => ({ file, message: `${name} from @mui/material: use row / col-* from Bootstrap` })),
      ...importSources(project.ast(file))
        .filter((entry) => /^@mui\/material\/(Unstable_)?Grid2?$/.test(entry.source))
        .map((entry) => ({ file, line: entry.line, message: 'MUI Grid: use row / col-* from Bootstrap' })),
    ]),
    ...(/"tailwindcss"/.test(project.read('package.json') || '')
      ? [{ file: 'package.json', message: 'Tailwind is not part of the stack' }]
      : []),
    ...project.targets
      .filter((file) => /\.(s?css)$/.test(file) && /@tailwind\b/.test(project.read(file)))
      .map((file) => ({ file, message: 'Tailwind directives: the stack styles with Bootstrap and the shell tokens' })),
  ],
};

const SHELL_CLASSES = /\b(left-side-menu|navbar-custom|content-page|logo-box|side-nav)\b/;

export const shellRule = {
  id: 'shell',
  severity: CHECK_SEVERITIES.error,
  summary: 'The frame is @link-loom/react-shell: the app never rebuilds it',
  run: (project) =>
    project.targets.filter(JSX_SOURCE.test.bind(JSX_SOURCE)).flatMap((file) => {
      const problems = [];
      walkAst(project.ast(file), (node) => {
        const isClassName = node.type === 'JSXAttribute' && node.name?.name === 'className';
        const value = isClassName && node.value?.type === 'StringLiteral' ? node.value.value : '';
        if (SHELL_CLASSES.test(value)) {
          problems.push({
            file,
            line: lineOf(node),
            message: `"${value}" is the shell's: use AppShell from @link-loom/react-shell`,
          });
        }
      });
      return problems;
    }),
};

const isBareDiv = (node) =>
  node?.type === 'JSXElement' &&
  node.openingElement.name?.name === 'div' &&
  node.openingElement.attributes.length === 0;

export const semanticRule = {
  id: 'semantic-html',
  severity: CHECK_SEVERITIES.warning,
  summary: 'Semantic HTML5: no wrappers inside wrappers without a reason',
  run: (project) =>
    project.targets.filter(JSX_SOURCE.test.bind(JSX_SOURCE)).flatMap((file) => {
      const problems = [];
      walkAst(project.ast(file), (node) => {
        const child = isBareDiv(node) && node.children.filter((item) => item.type === 'JSXElement');
        const grandchild =
          child?.length === 1 && isBareDiv(child[0]) && child[0].children.filter((item) => item.type === 'JSXElement');
        if (grandchild?.length === 1 && isBareDiv(grandchild[0])) {
          problems.push({
            file,
            line: lineOf(node),
            message: 'Three bare <div> deep: use section, header, article or nav',
          });
        }
      });
      return problems;
    }),
};

// Props that carry text people read; their value must come from the dictionaries.
const TEXT_PROPS = new Set([
  'label',
  'title',
  'placeholder',
  'aria-label',
  'alt',
  'helperText',
  'description',
  'tooltip',
]);
const WORDS = /[A-Za-zÀ-ÿ]{2,}/;

// A string literal, or a template literal without expressions: a fixed text.
const literalText = (node) => {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  return null;
};

export const copyRule = {
  id: 'copy',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every visible text comes from src/i18n (en and es)',
  run: (project) =>
    project.targets.filter(JSX_SOURCE.test.bind(JSX_SOURCE)).flatMap((file) => {
      const problems = [];
      walkAst(project.ast(file), (node) => {
        if (node.type === 'JSXText' && WORDS.test(node.value)) {
          problems.push({
            file,
            line: lineOf(node),
            message: `Text "${node.value.trim().slice(0, 40)}" in JSX: move it to src/i18n`,
          });
        }

        const textProp = node.type === 'JSXAttribute' && TEXT_PROPS.has(node.name?.name);
        const propText = textProp
          ? literalText(node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value)
          : null;
        if (propText !== null && WORDS.test(propText)) {
          problems.push({
            file,
            line: lineOf(node),
            message: `${node.name.name}="${propText.slice(0, 40)}": move it to src/i18n`,
          });
        }

        const child = node.type === 'JSXElement' || node.type === 'JSXFragment' ? node.children : [];
        for (const container of child.filter((item) => item.type === 'JSXExpressionContainer')) {
          const text = literalText(container.expression);
          if (text !== null && WORDS.test(text)) {
            problems.push({
              file,
              line: lineOf(container),
              message: `Text "${text.trim().slice(0, 40)}" in JSX: move it to src/i18n`,
            });
          }
        }
      });
      return problems;
    }),
};

// A colour literal: #rgb[a] or #rrggbb[aa] standing alone (not the #anchor of a link), or rgb()/rgba().
const COLOR = /(^|[^\w/&#-])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\brgba?\(/;

export const colorTokensRule = {
  id: 'color-tokens',
  severity: CHECK_SEVERITIES.error,
  summary: 'Colours come from src/constants/theme.js (npx link-loom brand colors), never a literal',
  run: (project) =>
    project.targets
      .filter((file) => isSource(file) && file !== 'src/constants/theme.js')
      .flatMap((file) => {
        const problems = [];
        walkAst(project.ast(file), (node) => {
          const text =
            node.type === 'StringLiteral' ? node.value : node.type === 'TemplateElement' ? node.value.raw : '';
          if (COLOR.test(text)) {
            problems.push({
              file,
              line: lineOf(node),
              message: `Colour "${text.slice(0, 30)}": use a token of the theme`,
            });
          }
        });
        return problems;
      }),
};

// The SDK each optional layer brings: without the layer, the app must not import it.
const LAYER_SDKS = Object.freeze({ '@sommatic/react-sdk': 'command-center', '@link-loom/cloud-sdk': 'stoneos' });

export const layersRule = {
  id: 'layers',
  severity: CHECK_SEVERITIES.error,
  summary: 'Pieces of a layer stay out of apps without that layer',
  run: (project) => {
    const layers = new Set(project.manifest.layers || []);
    return project.targets.filter(isSource).flatMap((file) =>
      importSources(project.ast(file))
        .filter((entry) => LAYER_SDKS[entry.source] && !layers.has(LAYER_SDKS[entry.source]))
        .map((entry) => ({
          file,
          line: entry.line,
          message: `${entry.source} belongs to the ${LAYER_SDKS[entry.source]} layer, which this app does not have`,
        })),
    );
  },
};
