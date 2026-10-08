import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { REQUIRED, proposeCommand } from '../src/ai/propose.js';

const fixture = (name) =>
  JSON.parse(fs.readFileSync(fileURLToPath(new URL(`./fixtures/ai/${name}.json`, import.meta.url)), 'utf8'));
const VALIDATION = fixture('requests');
const HOLDOUT = fixture('holdout');
const CONTEXT = { domains: VALIDATION.context.domains };

const sortedArgs = (args = {}) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(args)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value])
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );

/** How the rules do on a set of requests: right intent, exact arguments, and nothing invented. */
const score = (requests) => {
  const rows = requests.map((request) => {
    const proposal = proposeCommand(request.text, CONTEXT);
    const intent = proposal?.intent ?? null;
    const intentOk = intent === request.expected.tool;
    const missing = intent ? [...REQUIRED[intent].filter((field) => proposal.args[field] === undefined)].sort() : [];
    const argsOk =
      request.expected.tool === null
        ? intentOk
        : intentOk &&
          sortedArgs(proposal.args) === sortedArgs(request.expected.args) &&
          missing.join() === [...request.expected.missing].sort().join();
    const invented =
      request.category === 'incomplete' &&
      intent !== null &&
      request.expected.missing.some((field) => proposal.args[field] !== undefined);
    return { id: request.id, intentOk, argsOk, invented };
  });
  const rate = (key) => rows.filter((row) => row[key]).length / rows.length;
  return {
    intent: rate('intentOk'),
    args: rate('argsOk'),
    invented: rows.filter((row) => row.invented).map((row) => row.id),
    rows,
  };
};

describe('local AI: rules', () => {
  // Measured when the rules were ported; a change that lowers them is a regression of the TUI's suggestions.
  it('picks the right command and its arguments on the validation requests', () => {
    const result = score(VALIDATION.requests);

    expect(result.intent).toBeGreaterThanOrEqual(0.9);
    expect(result.args).toBeGreaterThanOrEqual(0.85);
  });

  it('holds up on requests it was not written against', () => {
    const result = score(HOLDOUT.requests);

    expect(result.intent).toBeGreaterThanOrEqual(0.85);
    expect(result.args).toBeGreaterThanOrEqual(0.8);
  });

  it('never invents what an incomplete request leaves out', () => {
    expect(score([...VALIDATION.requests, ...HOLDOUT.requests]).invented).toEqual([]);
  });

  it('turns a request into the command the CLI runs', () => {
    expect(proposeCommand('Agrega un CRUD de proveedores en inventario con copiar enlace', CONTEXT).command).toBe(
      'link-loom add entity --domain inventory --entity supplier --actions copy-link',
    );
    expect(proposeCommand('Necesito una webapp de administración que se llame backoffice', CONTEXT).argv).toEqual([
      'create',
      'webapp',
      '--name',
      'backoffice',
      '--variant',
      'admin',
    ]);
    expect(proposeCommand('Crea un proyecto nuevo', CONTEXT)).toMatchObject({
      intent: 'create_project',
      argv: null,
      missing: ['type', 'name'],
    });
    expect(proposeCommand('¿Cómo funciona el buscador?', CONTEXT)).toEqual({ help: true });
    expect(proposeCommand('recomiéndame una película', CONTEXT)).toBeNull();
  });

  it('in a landing, proposes sections, posts and pages by address, and never a webapp generator', () => {
    const LANDING = { type: 'landing' };

    expect(proposeCommand('Agrega una sección de preguntas frecuentes al inicio', LANDING).command).toBe(
      'link-loom add section --page home --kind faq',
    );
    expect(proposeCommand('add a cards section on the pricing page', LANDING).command).toBe(
      'link-loom add section --page pricing --kind cards',
    );
    expect(proposeCommand('Add a pricing page to the menu', LANDING).command).toBe(
      'link-loom add page --path /pricing --title-en Pricing --nav header',
    );
    expect(proposeCommand('write a blog post titled "Why one board beats ten tools"', LANDING).argv).toEqual([
      'add',
      'blog-post',
      '--slug',
      'why-one-board-beats-ten-tools',
      '--title-en',
      'Why one board beats ten tools',
    ]);
    expect(proposeCommand('Agrega un CRUD de productos', LANDING)?.intent).not.toBe('add_entity');
    expect(proposeCommand('Agrega una sección de logos', CONTEXT)?.intent).not.toBe('add_section');
  });
});
