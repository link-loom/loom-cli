import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCheckProject, importsFrom, parseSource, runChecks, walkAst } from '../src/index.js';

const makeProject = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-devkit-check-'));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
};

describe('check engine', () => {
  it('lists the project without dependencies, builds or agent folders', () => {
    const root = makeProject({
      'src/a.js': '',
      'node_modules/x/index.js': '',
      'dist/app.js': '',
      '.claude/skills/x.md': '',
      'tests/a.test.js': '',
    });

    expect(createCheckProject({ root, manifest: {} }).files.sort()).toEqual(['src/a.js', 'tests/a.test.js']);
  });

  it('inspects only the targets it is given, and still sees every file', () => {
    const root = makeProject({ 'src/a.js': '', 'src/b.js': '' });
    const project = createCheckProject({ root, manifest: {}, targets: new Set(['src/b.js']) });

    expect(project.targets).toEqual(['src/b.js']);
    expect(project.exists('src/a.js')).toBe(true);
  });

  it('reports ok only without errors; warnings never fail it', () => {
    const project = createCheckProject({ root: makeProject({ 'src/a.js': '' }), manifest: {} });
    const rules = [
      { id: 'clean', severity: 'error', summary: '', run: () => [] },
      { id: 'style', severity: 'warning', summary: '', run: () => [{ file: 'src/a.js', message: 'tidy' }] },
    ];

    expect(runChecks({ rules, project })).toMatchObject({ ok: true, errors: 0, warnings: 1 });
    expect(runChecks({ rules, project, only: ['clean'] }).checks.map((check) => check.id)).toEqual(['clean']);
  });

  it('parses JSX, walks it and reads its imports', () => {
    const ast = parseSource('import { Box, Grid } from "@mui/material";\nexport const A = () => <Box>Hi</Box>;\n');
    const texts = [];
    walkAst(ast, (node) => node.type === 'JSXText' && texts.push(node.value));

    expect(importsFrom(ast, '@mui/material')).toEqual({ default: null, named: ['Box', 'Grid'] });
    expect(texts).toEqual(['Hi']);
    expect(parseSource('const = ;')).not.toBeUndefined();
  });
});
