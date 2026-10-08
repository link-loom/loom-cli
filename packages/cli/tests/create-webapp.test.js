import fs from 'node:fs';

import { makeTempDir, runCli } from './helpers.js';

const SECRET = 'vp_test_51c0ffee';
const webapp = (flags, options) =>
  runCli(
    ['create', 'webapp', '--name', 'Acme Workspace', '--dry-run', '--json', '--cwd', makeTempDir(), ...flags],
    options,
  );

describe('create webapp', () => {
  it('plans the project without writing it', async () => {
    const outcome = await webapp([]);

    expect(outcome.code).toBe(0);
    expect(outcome.json()).toMatchObject({ ok: true, dryRun: true, project: { kind: 'webapp', basePath: '/client' } });
    expect(outcome.json().plan.create.map((entry) => entry.path)).toContain('acme-workspace/src/App.jsx');
  });

  it('never prints a secret given as a flag', async () => {
    const outcome = await webapp(['--veripass-api-key', SECRET]);

    expect(outcome.json().input.veripassApiKey).toBe('[secret]');
    expect(outcome.stdout).not.toContain(SECRET);
    expect(outcome.stderr).not.toContain(SECRET);
  });

  it('reads secrets from the environment with --from-env', async () => {
    const outcome = await webapp(['--from-env'], { env: { VERIPASS_API_KEY: SECRET } });

    expect(outcome.json().input.veripassApiKey).toBe('[secret]');
    expect(outcome.stdout).not.toContain(SECRET);
  });

  it('leaves secrets in the environment alone without --from-env', async () => {
    const outcome = await webapp([], { env: { VERIPASS_API_KEY: SECRET } });

    expect(outcome.json().input).not.toHaveProperty('veripassApiKey');
  });

  it('takes a list as comma-separated values', async () => {
    const outcome = await webapp(['--platforms', 'veripass,sommatic']);

    expect(outcome.json().input.platforms).toEqual(['veripass', 'sommatic']);
  });

  it('rejects a platform that does not exist with exit code 2 and redacts the input', async () => {
    const outcome = await webapp(['--platforms', 'veripass,nope', '--veripass-api-key', SECRET]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].code).toBe('E_VALIDATION');
    expect(outcome.stdout).not.toContain(SECRET);
  });
});

describe('brand', () => {
  const createProject = async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    return `${cwd}/acme-workspace`;
  };

  it('needs a project', async () => {
    const outcome = await runCli(['brand', 'colors', '--json', '--cwd', makeTempDir()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].code).toBe('E_USAGE');
  });

  it('shows the plan and asks for --yes before changing files', async () => {
    const project = await createProject();
    const planned = await runCli([
      'brand',
      'colors',
      '--header-color',
      '#1f4e79',
      '--dry-run',
      '--json',
      '--cwd',
      project,
    ]);
    const refused = await runCli(['brand', 'colors', '--header-color', '#1f4e79', '--json', '--cwd', project]);
    const applied = await runCli(['brand', 'colors', '--header-color', '#1f4e79', '--yes', '--json', '--cwd', project]);

    expect(planned.json().plan.modify.map((entry) => entry.path)).toContain('src/constants/theme.js');
    expect(refused.code).toBe(3);
    expect(refused.json().errors[0].code).toBe('E_CONFIRMATION_REQUIRED');
    expect(applied.code).toBe(0);
  }, 20000);

  it('rejects an unknown action', async () => {
    const outcome = await runCli(['brand', 'paint', '--json', '--cwd', await createProject()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0]).toMatchObject({ code: 'E_USAGE', allowed: ['colors', 'logo', 'assets', 'og'] });
  });
});

describe('services', () => {
  const TOKEN = 'r8_test_6b1d';
  const createProject = async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    return `${cwd}/acme-workspace`;
  };

  it('lists the services, active or not, and whether each key is set, never its value', async () => {
    const project = await createProject();
    const outcome = await runCli(['services', 'list', '--json', '--cwd', project]);
    const byId = Object.fromEntries(outcome.json().data.services.map((service) => [service.id, service]));

    expect(byId.veripass.active).toBe(true);
    expect(byId['image-generation'].active).toBe(false);
    expect(byId.backend.keys).toEqual([{ key: 'VITE_APP_BACKEND_URL', secret: false, set: true }]);
  });

  it('adds a service with its secrets from the environment, only to .env.local', async () => {
    const project = await createProject();
    const outcome = await runCli(
      ['services', 'add', 'image-generation', '--from-env', '--yes', '--json', '--cwd', project],
      {
        env: { REPLICATE_API_TOKEN: TOKEN },
      },
    );

    expect(outcome.code).toBe(0);
    expect(outcome.stdout).not.toContain(TOKEN);
    expect(outcome.json().data.keys).toContainEqual({ key: 'REPLICATE_API_TOKEN', secret: true, set: true });
    expect(fs.readFileSync(`${project}/.env.local`, 'utf8')).toContain(`REPLICATE_API_TOKEN=${TOKEN}`);
    expect(fs.readFileSync(`${project}/.env.sample`, 'utf8')).toContain('REPLICATE_API_TOKEN=\n');
  });

  it('sets a service URL and asks for --yes before changing env files', async () => {
    const project = await createProject();
    const refused = await runCli([
      'services',
      'config',
      'veripass',
      '--url',
      'https://id.acme.test',
      '--json',
      '--cwd',
      project,
    ]);
    const applied = await runCli([
      'services',
      'config',
      'veripass',
      '--url',
      'https://id.acme.test',
      '--yes',
      '--json',
      '--cwd',
      project,
    ]);

    expect(refused.json().errors[0].code).toBe('E_CONFIRMATION_REQUIRED');
    expect(applied.code).toBe(0);
    expect(fs.readFileSync(`${project}/.env.local`, 'utf8')).toContain(
      'VITE_APP_SERVICE_VERIPASS_URL=https://id.acme.test',
    );
  });

  it('rejects an unknown service with the list of known ones', async () => {
    const outcome = await runCli(['services', 'add', 'telepathy', '--json', '--cwd', await createProject()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].allowed).toContain('image-generation');
  });
});

describe('images', () => {
  const createProject = async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    return `${cwd}/acme-workspace`;
  };

  it('points to the images feature when the project has no manifest', async () => {
    const outcome = await runCli(['images', 'generate', 'hero', '--json', '--cwd', await createProject()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0]).toMatchObject({ code: 'E_USAGE', next: ['link-loom add feature images'] });
  });

  it('plans a generation with the provider the keys allow, without calling it', async () => {
    const project = await createProject();
    fs.writeFileSync(
      `${project}/images.manifest.json`,
      JSON.stringify({
        sourceDir: 'assets/img-source',
        outputDir: 'public/assets/img/photos',
        slots: [{ slot: 'hero', filename: 'hero.png', aspect: '16:9', prompt: 'A bright warehouse.' }],
      }),
    );

    const outcome = await runCli(['images', 'generate', 'hero', '--dry-run', '--json', '--cwd', project], {
      env: { REPLICATE_API_TOKEN: 'r8_test' },
    });

    expect(outcome.json()).toMatchObject({ dryRun: true, data: { provider: 'replicate', slots: ['hero'] } });
    expect(outcome.stdout).not.toContain('r8_test');
  });

  it('composes a page share image in the brand', async () => {
    const project = await createProject();
    const outcome = await runCli([
      'images',
      'og',
      '--title',
      'Pricing',
      '--tagline',
      'Plans for every team',
      '--json',
      '--cwd',
      project,
    ]);

    expect(outcome.json().data.file).toBe('public/brand/og-pricing.jpg');
    expect(fs.readFileSync(`${project}/public/brand/og-pricing.jpg`).subarray(0, 3).toString('hex')).toBe('ffd8ff');
  });
});

describe('add entity', () => {
  const createProject = async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    return `${cwd}/acme-workspace`;
  };
  const PRODUCT = [
    'add',
    'entity',
    '--domain',
    'inventory',
    '--entity',
    'product',
    '--fields',
    'name:text:required,price:number',
    '--json',
  ];

  it('plans the CRUD, then asks for --yes before it registers it in existing files', async () => {
    const project = await createProject();
    const planned = await runCli([...PRODUCT, '--dry-run', '--cwd', project]);
    const refused = await runCli([...PRODUCT, '--cwd', project]);
    const applied = await runCli([...PRODUCT, '--yes', '--cwd', project]);

    expect(planned.code).toBe(0);
    expect(planned.json().plan.create.map((entry) => entry.path)).toContain(
      'src/components/pages/inventory/product/list/InventoryProductList.component.jsx',
    );
    expect(planned.json().plan.modify.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(['src/i18n/en.js', 'src/components/layouts/sidebar/navigation.js', 'loom.json']),
    );
    expect(refused.code).toBe(3);
    expect(refused.json().errors[0].code).toBe('E_CONFIRMATION_REQUIRED');
    expect(applied.code).toBe(0);
    expect(fs.readFileSync(`${project}/src/i18n/en.js`, 'utf8')).toContain('new: "New product",');
    expect(applied.json().warnings[0]).toMatch(/^Spanish copy fell back to English/);
  }, 30000);

  it('answers with the schema problems when the input is wrong', async () => {
    const outcome = await runCli(['add', 'entity', '--domain', 'Inventory', '--json', '--cwd', await createProject()]);

    expect(outcome.code).toBe(2);
    expect(outcome.json().errors[0].code).toBe('E_VALIDATION');
  }, 20000);

  it('reads a list written with spaces, and asks to quote a value that is not a list', async () => {
    const project = await createProject();
    const spaced = await runCli([...PRODUCT, '--actions', 'quickview', 'copy-link', '--dry-run', '--cwd', project]);
    const unquoted = await runCli([...PRODUCT, '--singular-en', 'Big', 'product', '--dry-run', '--cwd', project]);

    expect(spaced.code).toBe(0);
    expect(spaced.json().input.actions).toEqual(['quickview', 'copy-link']);
    expect(unquoted.code).toBe(2);
    expect(unquoted.json().errors[0].problems[0].message).toBe('quote the value: --singular-en "Big product"');
  }, 20000);

  it('asks what to add, and refuses a generator the project type does not have', async () => {
    const project = await createProject();
    const missing = await runCli(['add', '--json', '--cwd', project]);
    const unknown = await runCli(['add', 'blog-post', '--json', '--cwd', project]);

    expect(missing.code).toBe(2);
    expect(missing.json().errors[0].code).toBe('E_USAGE');
    expect(unknown.json().errors[0].code).toBe('E_NOT_AVAILABLE');
  }, 20000);
});

describe('regenerating and placing', () => {
  it('generates an entity again with --replace, without leaving the old pieces behind', async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    const project = `${cwd}/acme-workspace`;
    const base = ['add', 'entity', '--domain', 'workspace', '--entity', 'project', '--yes', '--json', '--cwd', project];
    await runCli([...base, '--actions', 'quickview,delete', '--quick-add']);

    const again = await runCli([...base, '--actions', 'quickview,copy-link']);
    const replaced = await runCli([...base, '--actions', 'quickview,copy-link', '--replace']);
    const navigation = fs.readFileSync(`${project}/src/components/layouts/sidebar/navigation.js`, 'utf8');
    const quickAdd = fs.readFileSync(`${project}/src/components/layouts/navbar/quick-add.registry.js`, 'utf8');

    expect(again.code).toBe(3);
    expect(again.json().errors[0].next[0]).toContain('--replace');
    expect(replaced.code).toBe(0);
    expect(navigation.match(/workspace-projects/g)).toHaveLength(1);
    expect(quickAdd).not.toContain('workspace-project');
    expect(fs.existsSync(`${project}/src/components/pages/workspace/project/quick-actions`)).toBe(false);
    expect(fs.readFileSync(`${project}/tests/workspace/project/workspace-project.flow.test.jsx`, 'utf8')).not.toContain(
      'within',
    );
  }, 30000);

  it('creates the app in the working folder with --directory .', async () => {
    const cwd = makeTempDir();
    fs.writeFileSync(`${cwd}/.case`, 'kept');
    const created = await runCli([
      'create',
      'webapp',
      '--name',
      'Acme Workspace',
      '--directory',
      '.',
      '--no-install',
      '--json',
      '--cwd',
      cwd,
    ]);
    const again = await runCli([
      'create',
      'webapp',
      '--name',
      'Other',
      '--directory',
      '.',
      '--no-install',
      '--json',
      '--cwd',
      cwd,
    ]);

    expect(created.code).toBe(0);
    expect(fs.existsSync(`${cwd}/loom.json`)).toBe(true);
    expect(created.json().next.slice(0, 2)).toEqual(['npm install', 'npm run dev']);
    expect(again.code).toBe(3);
  }, 30000);
});
