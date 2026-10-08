import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, render } from 'ink-testing-library';

import { html } from '../src/tui/html.js';
import { App } from '../src/tui/App.js';
import { Home } from '../src/tui/screens/Home.js';
import { ProjectHome } from '../src/tui/screens/ProjectHome.js';
import { CheckList } from '../src/tui/components/CheckList.js';
import { optionsIn } from '../src/ai/extract.js';
import { Wizard, pendingFields } from '../src/tui/screens/Wizard.js';
import { LOGO_FRAMES, LOGO_ROWS, logoFrame } from '../src/tui/components/Logo.js';
import { spinnerFrame } from '../src/tui/components/Spinner.js';
import { agentCommand } from '../src/tui/agent-command.js';
import { getStrings } from '../src/tui/i18n.js';
import { personName, shouldAnimate } from '../src/tui/index.js';
import { LOOMI_FRAMES, LOOMI_PALETTE, spriteRows } from '../src/tui/components/loomi.sprite.js';
import { Welcome, titledBorder } from '../src/tui/components/Welcome.js';
import { STEP_STATES, Steps, progressBar } from '../src/tui/components/Steps.js';
import { leftoverCommands } from '../src/tui/screens/Finished.js';
import { createSchema } from '../src/commands/create.js';
import { SERVICE_TEMPLATE, makeTempDir, waitFor } from './helpers.js';

const ENTER = '\r';
const ARROW_DOWN = '\u001B[B';
// The full flow previews, writes and renders several screens; it needs more than Jest's 5 s default.
const FLOW_TIMEOUT_MS = 15000;

const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
// The frame an app left in the terminal when it closed (the testing renderer clears its last frame on exit).
const lastCard = (frames) => frames.filter((frame) => frame.trim()).at(-1) || '';

afterEach(() => cleanup());

describe('logo', () => {
  it('starts as bare warp threads and ends as the full wordmark', () => {
    const first = logoFrame(0).map((cells) => cells.map((cell) => cell.text).join(''));

    expect(first.join('')).not.toMatch(/[█▀▄]/);
    expect(logoFrame(LOGO_FRAMES).map((cells) => cells[0].text)).toEqual(LOGO_ROWS);
  });

  it('moves the shuttle across the threads', () => {
    expect(spinnerFrame(0)).toBe('▸─═─═─');
    expect(spinnerFrame(1)).toBe('═▸═─═─');
  });
});

describe('loomi', () => {
  it('draws every frame of every state on the same canvas, two pixels per text cell', () => {
    for (const frames of Object.values(LOOMI_FRAMES)) {
      for (const { rows } of frames) {
        expect(rows).toHaveLength(16);
        expect(new Set(rows.map((row) => row.length))).toEqual(new Set([26]));
        expect(spriteRows(rows)).toHaveLength(8);
      }
    }
  });

  it('keeps the silhouette and the eyes without colour', () => {
    const plain = spriteRows(LOOMI_FRAMES.idle[0].rows, { color: false }).map((cells) =>
      cells.map((cell) => cell.text).join(''),
    );

    expect(plain.join('')).toMatch(/█/);
    // The eyes are 3 pixels wide and leave a 3-cell hole in the fur.
    expect(plain[3]).toMatch(/█ {3}█/);
  });

  it('paints two-colour cells as the lower half over the top colour, so a short glyph never shows a wrong strip on top', () => {
    const [[mouth, fur]] = spriteRows(['FF', 'PF']);

    expect(mouth).toEqual({ text: '▄', color: LOOMI_PALETTE.P, backgroundColor: LOOMI_PALETTE.F });
    expect(fur).toEqual({ text: '█', color: LOOMI_PALETTE.F, backgroundColor: LOOMI_PALETTE.F });
  });

  it('wears a hard hat and holds its tools at work', () => {
    const [frame] = LOOMI_FRAMES.working;

    expect(frame.rows.slice(0, 4).join('')).toMatch(/Y/);
    expect(frame.rows.join('')).toMatch(/g/);
  });
});

describe('progress and leftovers', () => {
  it('draws the share of the install as a bar and a percentage', () => {
    const bar = progressBar(512 / 1203);

    expect(bar.percent).toBe('42%');
    expect(bar.filled.length + bar.empty.length).toBe(20);
    expect(progressBar(0).percent).toBe('0%');
    expect(progressBar(1.4).percent).toBe('100%');
  });

  it('shows the install bar under the active step, in both halves', () => {
    const step = (progress) => [
      { id: 'install', label: 'Installing dependencies', state: STEP_STATES.active, progress },
    ];
    const resolving = render(
      html`<${Steps}
        steps=${step({ phase: 'resolving', found: 400, share: 0.24 })}
        strings=${getStrings('en')}
        animate=${false}
      />`,
    );
    expect(resolving.lastFrame()).toContain('24%');
    expect(resolving.lastFrame()).toContain('working out which packages it needs · 400 found');

    const installing = render(
      html`<${Steps}
        steps=${step({ phase: 'installing', done: 512, total: 1203, share: 0.71 })}
        strings=${getStrings('es')}
        animate=${false}
      />`,
    );
    expect(installing.lastFrame()).toContain('71%');
    expect(installing.lastFrame()).toContain('512 de 1203 paquetes instalados');
  });

  it('says how to delete or finish a project left halfway', () => {
    expect(leftoverCommands('acme', 'darwin')).toEqual({ remove: 'rm -rf acme', finish: 'cd acme && npm install' });
    expect(leftoverCommands('acme admin', 'win32').remove).toBe("rmdir /s /q 'acme admin'");
    expect(leftoverCommands('')).toEqual({ finish: 'npm install' });
    expect(leftoverCommands(null)).toBeNull();
  });
});

describe('welcome', () => {
  it('greets the person by name in a frame titled with the version, with the tips beside', () => {
    const { lastFrame } = render(
      html`<${Welcome}
        strings=${getStrings('es')}
        version="3.0.0"
        person="Camilo"
        cwd="~/demo"
        columns=${100}
        animate=${false}
        sections=${[{ title: 'Para empezar', lines: [{ text: 'Elige abajo qué crear,' }] }]}
      />`,
    );

    expect(lastFrame()).toContain('Link Loom v3.0.0');
    expect(lastFrame()).toContain('¡Hola, Camilo!');
    expect(lastFrame()).toContain('Para empezar');
    expect(lastFrame()).toContain('~/demo');
  });

  it('leaves the tips out in a narrow terminal', () => {
    const { lastFrame } = render(
      html`<${Welcome}
        strings=${getStrings('en')}
        version="3.0.0"
        columns=${60}
        animate=${false}
        sections=${[{ title: 'Getting started', lines: [{ text: 'Pick' }] }]}
      />`,
    );

    expect(lastFrame()).toContain('Hi there!');
    expect(lastFrame()).not.toContain('Getting started');
  });

  it('sets the title in the top border and fills it to the width', () => {
    const border = titledBorder('Link Loom v3', 40);

    expect(`${border.lead}${border.title}${border.tail}`).toHaveLength(40);
  });

  it('reads the name to greet from LINK_LOOM_NAME before git', () => {
    expect(personName({ env: { LINK_LOOM_NAME: 'Ana María' } })).toBe('Ana María');
    expect(personName({ env: { LINK_LOOM_NAME: '' } })).toBeNull();
  });
});

describe('home', () => {
  it('asks what to create and marks what is not available yet', () => {
    const { lastFrame } = render(
      html`<${Home} strings=${getStrings('es')} locale="es" animate=${false} onPick=${() => {}} onExit=${() => {}} />`,
    );

    expect(lastFrame()).toContain('¿Qué quieres crear?');
    expect(lastFrame()).toContain('Backend monolito');
    expect(lastFrame()).toContain('próximamente');
    expect(lastFrame()).toContain('Soy Loomi. ¡Tejamos algo juntos!');
  });

  it('filters the list as the person types', async () => {
    const { lastFrame, stdin } = render(
      html`<${Home} strings=${getStrings('en')} locale="en" animate=${false} onPick=${() => {}} onExit=${() => {}} />`,
    );

    stdin.write('micro');
    await tick();

    expect(lastFrame()).toContain('Microservice');
    expect(lastFrame()).not.toContain('Landing page');
  });

  it('starts on the first project type that can be chosen', async () => {
    const picked = [];
    const { stdin } = render(
      html`<${Home}
        strings=${getStrings('en')}
        locale="en"
        animate=${false}
        onPick=${(type) => picked.push(type.id)}
        onExit=${() => {}}
      />`,
    );

    stdin.write(ENTER);
    await tick();

    expect(picked).toEqual(['landing']);
  });

  it('does not let a planned project type be chosen', async () => {
    const picked = [];
    const { stdin } = render(
      html`<${Home}
        strings=${getStrings('en')}
        locale="en"
        animate=${false}
        onPick=${(type) => picked.push(type.id)}
        onExit=${() => {}}
      />`,
    );

    for (let step = 0; step < 5; step += 1) {
      stdin.write(ARROW_DOWN);
      await tick();
    }
    stdin.write(ENTER);
    await tick();

    expect(picked).toEqual([]);
  });
});

describe('wizard', () => {
  it('asks only for the prompted fields that are still unknown, in order', () => {
    const schema = createSchema('service');

    expect(pendingFields(schema, {}).map((field) => field.name)).toEqual(['name', 'shape']);
    expect(pendingFields(schema, { shape: 'monolith' }).map((field) => field.name)).toEqual(['name']);
  });

  it('validates the answer against the schema pattern before moving on', async () => {
    const done = [];
    const { lastFrame, stdin } = render(
      html`<${Wizard}
        schema=${createSchema('service')}
        initialValues=${{ shape: 'monolith' }}
        strings=${getStrings('en')}
        locale="en"
        onDone=${(values) => done.push(values)}
        onCancel=${() => {}}
      />`,
    );

    stdin.write('-bad');
    await tick();
    stdin.write(ENTER);
    await tick();
    expect(lastFrame()).toContain('does not match');
    expect(done).toEqual([]);
  });

  it('returns the answers', async () => {
    const done = [];
    const { stdin } = render(
      html`<${Wizard}
        schema=${createSchema('service')}
        initialValues=${{ shape: 'monolith' }}
        strings=${getStrings('en')}
        locale="en"
        onDone=${(values) => done.push(values)}
        onCancel=${() => {}}
      />`,
    );

    stdin.write('billing');
    await tick();
    stdin.write(ENTER);
    await tick();

    expect(done).toEqual([{ shape: 'monolith', name: 'billing' }]);
  });
});

describe('app flow', () => {
  it(
    'reviews the plan, creates the project and shows the equivalent agent command',
    async () => {
      const cwd = makeTempDir();
      const exits = [];
      const { lastFrame, stdin } = render(
        html`<${App}
          cwd=${cwd}
          global=${{ template: SERVICE_TEMPLATE, install: false }}
          locale="en"
          animate=${false}
          target="service"
          prefill=${{ name: 'demo' }}
          onExit=${(code) => exits.push(code)}
        />`,
      );

      await waitFor(() => lastFrame().includes('This is what will be created'));
      expect(lastFrame()).toContain('demo/package.json');
      expect(fs.existsSync(path.join(cwd, 'demo'))).toBe(false);

      // Ink subscribes to input in an effect after the frame shows; give it a tick before typing.
      await tick();
      stdin.write(ENTER);
      await waitFor(() => lastFrame().includes('All set!'));
      expect(lastFrame()).toContain('link-loom create service --shape monolith --name demo --json');
      expect(fs.existsSync(path.join(cwd, 'demo/package.json'))).toBe(true);

      await tick();
      stdin.write('q');
      await waitFor(() => exits.length > 0);
      expect(exits).toEqual([0]);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    'runs a typed command straight away and closes on its last card',
    async () => {
      const cwd = makeTempDir();
      const exits = [];
      const { frames } = render(
        html`<${App}
          cwd=${cwd}
          global=${{ template: SERVICE_TEMPLATE, install: false }}
          locale="en"
          animate=${false}
          target="service"
          prefill=${{ name: 'demo' }}
          autoRun=${true}
          onExit=${(code) => exits.push(code)}
        />`,
      );

      await waitFor(() => exits.length > 0);
      expect(exits).toEqual([0]);
      expect(lastCard(frames)).toContain('All set!');
      expect(lastCard(frames)).toContain('link-loom create service');
      expect(lastCard(frames)).not.toContain('press any key');
      expect(fs.existsSync(path.join(cwd, 'demo/package.json'))).toBe(true);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    'closes on Loomi sad when Ctrl+C arrives while it works, and says what was left',
    async () => {
      const exits = [];
      const interrupts = new EventEmitter();
      const { frames } = render(
        html`<${App}
          cwd=${makeTempDir()}
          global=${{ template: SERVICE_TEMPLATE, install: false }}
          locale="es"
          animate=${false}
          target="service"
          prefill=${{ name: 'demo' }}
          autoRun=${true}
          interrupts=${interrupts}
          onExit=${(code) => exits.push(code)}
        />`,
      );

      interrupts.emit('interrupt');
      await waitFor(() => exits.length > 0);
      expect(exits).toEqual([130]);
      expect(lastCard(frames)).toContain('Detenido.');
      expect(lastCard(frames)).toContain('Presionaste Ctrl+C antes de que terminara.');
    },
    FLOW_TIMEOUT_MS,
  );

  it('closes on Ctrl+C in the menu with nothing written', async () => {
    const exits = [];
    const { frames, stdin } = render(
      html`<${App}
        cwd=${makeTempDir()}
        global=${{}}
        locale="en"
        animate=${false}
        onExit=${(code) => exits.push(code)}
      />`,
    );

    await tick();
    stdin.write('\u0003');
    await waitFor(() => exits.length > 0);
    expect(exits).toEqual([130]);
    expect(lastCard(frames)).toContain('Cancelled. Nothing was written.');
  });

  it(
    'writes nothing when the review is cancelled',
    async () => {
      const cwd = makeTempDir();
      const { lastFrame, stdin } = render(
        html`<${App}
          cwd=${cwd}
          global=${{ template: SERVICE_TEMPLATE, install: false }}
          locale="en"
          animate=${false}
          target="service"
          prefill=${{ name: 'demo' }}
          onExit=${() => {}}
        />`,
      );

      await waitFor(() => lastFrame().includes('This is what will be created'));
      await tick();
      stdin.write('\u001B');
      await waitFor(() => lastFrame().includes('Nothing was written'));
      expect(fs.existsSync(path.join(cwd, 'demo'))).toBe(false);
    },
    FLOW_TIMEOUT_MS,
  );
});

describe('review', () => {
  it(
    'shows the palette of a webapp before anything is written',
    async () => {
      const cwd = makeTempDir();
      const { lastFrame } = render(
        html`<${App}
          cwd=${cwd}
          global=${{ install: false }}
          locale="en"
          animate=${false}
          target="webapp"
          prefill=${{ name: 'Acme Workspace', variant: 'client', description: '', descriptionEs: '', defaultLocale: 'en', signup: true, stoneos: true, commandCenter: true, brandMode: 'default', backendUrl: '', veripassUrl: '', veripassApiKey: '', loomCloudUrl: '', sommaticUrl: '' }}
          onExit=${() => {}}
        />`,
      );

      await waitFor(() => lastFrame().includes('This is what will be created'), { timeout: 10000 });
      expect(lastFrame()).toContain('header #3c4876');
      expect(lastFrame()).toContain('logo area #2f3a5f');
    },
    FLOW_TIMEOUT_MS,
  );
});

describe('wizard conditions', () => {
  it('asks for the preset only when the person chooses a preset palette', () => {
    const schema = createSchema('webapp');

    expect(pendingFields(schema, { name: 'x' }).map((field) => field.name)).not.toContain('brandPreset');
    expect(pendingFields(schema, { name: 'x', brandMode: 'preset' }).map((field) => field.name)).toContain(
      'brandPreset',
    );
  });

  it('asks for the Link Loom Cloud URL only with StoneOS', () => {
    const schema = createSchema('webapp');

    expect(pendingFields(schema, { name: 'x' }).map((field) => field.name)).toContain('loomCloudUrl');
    expect(pendingFields(schema, { name: 'x', stoneos: false }).map((field) => field.name)).not.toContain(
      'loomCloudUrl',
    );
  });

  it('offers yes and no for a boolean, with the default first', async () => {
    const schema = createSchema('webapp');
    const known = Object.fromEntries(pendingFields(schema, {}).map((field) => [field.name, 'x']));
    delete known.signup;
    const { lastFrame } = render(
      html`<${Wizard}
        schema=${schema}
        initialValues=${known}
        strings=${getStrings('en')}
        locale="en"
        onDone=${() => {}}
        onCancel=${() => {}}
      />`,
    );

    expect(lastFrame()).toContain('Let people sign up');
    expect(lastFrame().indexOf('Yes')).toBeLessThan(lastFrame().indexOf('No'));
  });
});

describe('helpers', () => {
  it('keeps secrets out of the agent command and reads them from the environment instead', () => {
    const command = agentCommand(
      'webapp',
      { name: 'Acme', veripassApiKey: 'vp_x', platforms: ['veripass', 'vca'] },
      createSchema('webapp'),
    );

    expect(command).toBe(
      'VERIPASS_API_KEY=<secret> link-loom create webapp --name Acme --platforms veripass,vca --from-env --json',
    );
  });

  it('builds the deterministic command an agent would run', () => {
    expect(agentCommand('service', { name: 'billing svc', shape: 'monolith', install: false })).toBe(
      "link-loom create service --name 'billing svc' --shape monolith --no-install --json",
    );
  });

  it('turns animation off with --no-animation, NO_COLOR, CI or a narrow terminal', () => {
    expect(shouldAnimate({ global: {}, env: {}, columns: 100 })).toBe(true);
    expect(shouldAnimate({ global: { animation: false }, env: {}, columns: 100 })).toBe(false);
    expect(shouldAnimate({ global: {}, env: { NO_COLOR: '1' }, columns: 100 })).toBe(false);
    expect(shouldAnimate({ global: {}, env: { CI: 'true' }, columns: 100 })).toBe(false);
    expect(shouldAnimate({ global: {}, env: {}, columns: 40 })).toBe(false);
  });
});

describe('inside a project', () => {
  const createProject = async () => {
    const { runCli } = await import('./helpers.js');
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    return `${cwd}/acme-workspace`;
  };

  it(
    'opens on the project and what can be added to it',
    async () => {
      const { describeProject } = await import('../src/commands/describe.js');
      const project = await describeProject(await createProject());
      const { lastFrame } = render(
        html`<${App}
          cwd=${project.root}
          global=${{}}
          locale="en"
          animate=${false}
          project=${project}
          onExit=${() => {}}
        />`,
      );

      await waitFor(() => lastFrame().includes('What do you want to add?'));
      expect(lastFrame()).toContain('Acme Workspace · webapp client');
      expect(lastFrame()).toContain('add entity');
      expect(lastFrame()).toContain('add page');
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    'adds a piece through the wizard, the plan and the equivalent agent command',
    async () => {
      const root = await createProject();
      const { lastFrame, stdin } = render(
        html`<${App}
          cwd=${root}
          global=${{}}
          locale="en"
          animate=${false}
          generator="copy"
          prefill=${{ key: 'reports.lowStock', en: 'Low stock', es: 'Inventario bajo' }}
          onExit=${() => {}}
        />`,
      );

      await waitFor(() => lastFrame().includes('This is what will be created'));
      expect(lastFrame()).toContain(
        "link-loom add copy --key reports.lowStock --en 'Low stock' --es 'Inventario bajo' --json",
      );
      expect(fs.readFileSync(path.join(root, 'src/i18n/es.js'), 'utf8')).not.toContain('Inventario bajo');

      await tick();
      stdin.write(ENTER);
      await waitFor(() => lastFrame().includes('All set!'));
      expect(fs.readFileSync(path.join(root, 'src/i18n/es.js'), 'utf8')).toContain('lowStock: "Inventario bajo",');
    },
    FLOW_TIMEOUT_MS,
  );

  it('marks several row actions at once', async () => {
    const done = [];
    const schema = {
      properties: {
        actions: {
          type: 'array',
          items: { enum: ['quickview', 'copy-link', 'delete'] },
          default: ['quickview'],
          'x-prompt': { en: 'Row actions' },
        },
      },
    };
    const { lastFrame, stdin } = render(
      html`<${Wizard}
        schema=${schema}
        initialValues=${{}}
        strings=${getStrings('en')}
        locale="en"
        onDone=${(values) => done.push(values)}
        onCancel=${() => {}}
      />`,
    );

    await tick();
    expect(lastFrame()).toContain('[x] quickview');
    stdin.write('\u001B[B');
    await tick();
    stdin.write(' ');
    await tick();
    stdin.write(ENTER);
    await waitFor(() => done.length > 0);
    expect(done).toEqual([{ actions: ['quickview', 'copy-link'] }]);
  });
});

describe('local AI in the palette', () => {
  it('proposes the create command for a request and opens it with what the request said', async () => {
    const suggested = [];
    const { lastFrame, stdin } = render(
      html`<${Home}
        strings=${getStrings('en')}
        locale="en"
        animate=${false}
        onPick=${() => {}}
        onSuggest=${(suggestion) => suggested.push(suggestion)}
        onExit=${() => {}}
      />`,
    );

    stdin.write('create a landing page called acme');
    await tick();
    expect(lastFrame()).toContain('Suggested');
    expect(lastFrame()).toContain('link-loom create landing --name acme');
    stdin.write(ENTER);
    await tick();

    expect(suggested).toEqual([{ projectType: expect.objectContaining({ id: 'landing' }), prefill: { name: 'acme' } }]);
  });

  it('inside a landing, proposes the section a request asks for', async () => {
    const suggested = [];
    const project = { type: 'landing', name: 'Acme', layers: ['base'], pages: [] };
    const generators = [{ id: 'page' }, { id: 'section' }, { id: 'blog-post' }, { id: 'copy' }].map((generator) => ({
      ...generator,
      description: generator.id,
    }));
    const { lastFrame, stdin } = render(
      html`<${ProjectHome}
        strings=${getStrings('es')}
        animate=${false}
        project=${project}
        generators=${generators}
        onPick=${() => {}}
        onSuggest=${(suggestion) => suggested.push(suggestion)}
        onExit=${() => {}}
      />`,
    );

    stdin.write('agrega preguntas frecuentes al inicio');
    await tick();
    expect(lastFrame()).toContain('link-loom add section --page home --kind faq');
    stdin.write(ENTER);
    await tick();

    expect(suggested).toEqual([{ generator: 'section', prefill: { page: 'home', kind: 'faq' } }]);
  });
});

describe('fixes after an error', () => {
  it('offers what the error says to do next, or the command with the flag it asked for', async () => {
    const { fixesFor } = await import('../src/tui/fix.js');

    expect(fixesFor({ code: 'E_TARGET_EXISTS', details: { next: ['Pass --replace --yes to rewrite it'] } })).toEqual([
      'Pass --replace --yes to rewrite it',
    ]);
    expect(fixesFor({ code: 'E_CONFIRMATION_REQUIRED', details: {} }, 'link-loom add page')).toEqual([
      'link-loom add page --yes',
    ]);
    expect(fixesFor({ code: 'E_VALIDATION', details: { missing: ['titleEn'] } }, 'link-loom add page')).toEqual([
      'link-loom add page --title-en <value>',
    ]);
    expect(fixesFor({ code: 'E_IO', details: {} })).toEqual([]);
  });
});

describe('options from words', () => {
  it('marks the row actions a person names, then confirms them', async () => {
    const done = [];
    const items = ['quickview', 'open-new-tab', 'copy-id', 'delete'].map((action) => ({
      key: action,
      label: action,
      value: action,
    }));
    const { lastFrame, stdin } = render(
      html`<${CheckList}
        items=${items}
        initial=${['quickview']}
        fromText=${(text, options) => optionsIn(text, options, 'actions')}
        onDone=${(values) => done.push(values)}
        onCancel=${() => {}}
      />`,
    );

    stdin.write('copiar id y abrir en nueva pestaña');
    await tick();
    expect(lastFrame()).toContain('› copiar id y abrir en nueva pestaña');
    stdin.write(ENTER);
    await tick();
    expect(lastFrame()).toContain('[x] copy-id');
    stdin.write(ENTER);
    await tick();

    expect(done).toEqual([['open-new-tab', 'copy-id']]);
  });
});
