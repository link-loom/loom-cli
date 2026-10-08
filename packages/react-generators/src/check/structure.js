import { CHECK_SEVERITIES } from '@link-loom/devkit';

import { isSource } from './files.js';

// What each folder of src/ may hold, by file name. Anything else is a piece put where the CLI would not put it.
const PLACES = [
  { folder: 'src/pages/', pattern: /^[A-Z][A-Za-z0-9]*\.page\.jsx$/, expected: '<Domain><Name>.page.jsx' },
  {
    folder: 'src/components/',
    pattern:
      /^([A-Z][A-Za-z0-9]*\.(component|sommatic)\.jsx|[a-z][a-z0-9-]*\.(extension|hooks)\.jsx|[a-z][a-z0-9-]*\.(registry|sections|config|utils)\.js|navigation\.js)$/,
    expected: '<Name>.component.jsx, <Name>.sommatic.jsx or a registry (<name>.registry.js, <name>.sections.js)',
  },
  { folder: 'src/services/', pattern: /^[a-z][a-z0-9-]*\.service\.js$/, expected: '<domain>-<entity>.service.js' },
  { folder: 'src/hooks/', pattern: /^use[A-Z][A-Za-z0-9]*\.hook\.jsx?$/, expected: 'use<Name>.hook.js' },
  { folder: 'src/utils/', pattern: /^[a-z][a-z0-9-]*\.utils\.js$/, expected: '<name>.utils.js' },
  {
    folder: 'src/routes/',
    pattern: /^([a-z][a-z0-9-]*\.routes\.jsx|index\.js)$/,
    expected: '<domain>[-<entity>].routes.jsx',
  },
  { folder: 'src/layouts/', pattern: /^Layout[A-Z][A-Za-z0-9]*\.jsx$/, expected: 'Layout<Name>.jsx' },
  {
    folder: 'src/constants/',
    pattern: /^(theme|iconLibrary|[a-z][a-z0-9-]*\.constants)\.js$/,
    expected: 'theme.js, iconLibrary.js or <name>.constants.js',
  },
  { folder: 'src/i18n/', pattern: /^(en|es|index)\.js$/, expected: 'en.js, es.js and index.js only' },
];

const ROOT_FILES = new Set(['src/main.jsx', 'src/App.jsx', 'src/app.config.js']);

export const structureRule = {
  id: 'structure',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every source file sits in its folder with its suffix',
  run: (project) =>
    project.targets.filter(isSource).flatMap((file) => {
      if (ROOT_FILES.has(file)) {
        return [];
      }

      const place = PLACES.find((candidate) => file.startsWith(candidate.folder));
      const name = file.split('/').at(-1);
      if (!place) {
        return [{ file, message: 'This folder is not part of the project layout (see AGENTS.md, "Where things go")' }];
      }

      return place.pattern.test(name) ? [] : [{ file, message: `Expected ${place.expected}` }];
    }),
};
