import { CHECK_SEVERITIES } from '@link-loom/devkit';

const PAGE = /^src\/pages\/.*\.page\.jsx$/;
const PAGE_IMPORT = /(?:import\(|from )"@pages\/([^"]+)"/g;

export const pageLoadedRule = {
  id: 'page-loaded',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every page renders <OnPageLoaded/>, which hides the boot loader and tells the shell it is ready',
  run: (project) =>
    project.targets
      .filter((file) => PAGE.test(file))
      .filter((file) => !project.read(file).includes('<OnPageLoaded'))
      .map((file) => ({ file, message: 'Render <OnPageLoaded /> from @link-loom/react-sdk after the page component' })),
};

export const orphanPagesRule = {
  id: 'orphan-pages',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every page has a route, and every route loads a page that exists',
  run: (project) => {
    const routeFiles = project.files.filter((file) => /^src\/routes\/.*\.jsx?$/.test(file) || file === 'src/App.jsx');
    const loaded = routeFiles.flatMap((file) =>
      [...project.read(file).matchAll(PAGE_IMPORT)].map((match) => ({ file, page: `src/pages/${match[1]}.jsx` })),
    );
    const pages = project.files.filter((file) => PAGE.test(file));
    return [
      ...pages
        .filter((page) => !loaded.some((entry) => entry.page === page))
        .map((file) => ({ file, message: 'No route loads this page: add it to its domain routes or delete it' })),
      ...loaded
        .filter((entry) => !project.exists(entry.page))
        .map((entry) => ({ file: entry.file, message: `Loads ${entry.page}, which does not exist` })),
    ];
  },
};
