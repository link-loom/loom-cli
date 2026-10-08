import { CHECK_SEVERITIES } from '@link-loom/devkit';

import { sourcesOf, testPathsOf } from './files.js';

// The code that carries behaviour, and so a test of its own. Pages, routes and layouts are covered by the routes test.
const TESTED = /^src\/(components|hooks|services|utils)\/.*\.(js|jsx)$/;
const UNIT_TEST = /^tests\/.*\.test\.(js|jsx)$/;
const SHARED_TESTS = /^tests\/(support|routes|i18n)\//;
const FLOW_TEST = /^tests\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/\1-\2\.flow\.test\.jsx$/;

export const testsRule = {
  id: 'tests',
  severity: CHECK_SEVERITIES.error,
  summary: 'Every component, hook, service and utility has its test, and no test is left without its code',
  run: (project) => {
    const missing = project.targets
      .filter((file) => TESTED.test(file))
      .filter((file) => !testPathsOf(file).some((test) => project.exists(test)))
      .map((file) => ({
        file,
        message: `No test: expected ${testPathsOf(file)[1].replace(/\.test\.jsx$/, '.test.jsx|js')}`,
      }));
    const orphans = project.files
      .filter((file) => UNIT_TEST.test(file) && !SHARED_TESTS.test(file))
      .filter((file) => {
        const flow = FLOW_TEST.exec(file);
        if (flow) {
          return !project.files.some((source) => source.startsWith(`src/components/pages/${flow[1]}/${flow[2]}/`));
        }

        return !sourcesOf(file).some((source) => project.exists(source));
      })
      .map((file) => ({ file, message: 'Its code no longer exists: delete the test or restore the code' }));
    return [...missing, ...orphans];
  },
};
