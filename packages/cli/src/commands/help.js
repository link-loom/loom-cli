import { CLI_VERSION } from '../version.js';

export const HELP_TEXT = `link-loom ${CLI_VERSION}

Usage
  link-loom                         open the interactive home (in a terminal)
  link-loom create <type> [flags]   landing | webapp | service
  link-loom add <generator> [flags] entity (a CRUD from the kit), inside a webapp
  link-loom brand <action> [flags]  colors | logo | assets | og, inside a webapp
  link-loom services <action> [id]  list | add | config: backends and API keys (.env.local only)
  link-loom images <action> [slots] generate (at most 5 slots) | optimize | og --title, in any frontend
  link-loom update [--check]        the project to this CLI's stack: versions, lock, migrations, install, check, build
  link-loom skills <action> [name]  list | install | sync: the agent skills of the project (--force replaces hand edits)
  link-loom check [--changed]       the quality gate of a project (exit 4 when a rule fails)
  link-loom describe [--project]    what the CLI can do, or what this project holds (use --json)
  link-loom mcp                     the same commands as an MCP server over stdio
  link-loom migrate <action>        analyze <repo> | apply --decisions <file> --out <dir> | finish [dir]: an existing webapp onto the standard (temporary)
  link-loom ai <action>             status | install | remove | ask "<question>": the local model of the TUI (37 MB, once)
  link-loom schema <name>           JSON Schema of a generator (--type webapp|landing when two types have it)
  link-loom <command> <name> --help the flags of one generator: create webapp --help, add entity --help

Global flags
  --json          one JSON document on stdout; logs on stderr (agent mode)
  --dry-run       return the plan, write nothing
  --yes           confirm changes that modify or delete existing files
  --from-env      read secrets from their environment variables (see the schema's x-env)
  --changed       check only what git sees as changed
  --cwd <dir>     working directory
  --input <file>  generator input as JSON (- for stdin); flags override it
  --no-install    skip npm install after create
  --no-animation  static TUI
  --no-fullscreen the TUI inline, under the prompt, instead of taking the whole terminal
  --no-ai         the TUI reads requests with its rules alone, without the local model
  --offline       never download anything

Examples
  link-loom create webapp --name "Acme Workspace" --variant client --json
  link-loom add entity --domain inventory --entity product --fields name:text:required,price:number --json
  link-loom brand colors --header-color "#1f4e79" --dry-run --json
  REPLICATE_API_TOKEN=… link-loom services add image-generation --from-env --yes --json
  link-loom create service --name billing-svc --shape microservice --json
  link-loom create service --name billing-svc --dry-run --json
`;

const flagOf = (name) => `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const valueHint = (property) => {
  if (property.enum) {
    return property.enum.join('|');
  }

  if (property.type === 'array') {
    return property.items?.enum ? `${property.items.enum.join(',')}` : 'a,b,c';
  }

  return property.type === 'boolean' ? '' : `<${property.type || 'value'}>`;
};

/** One generator's flags, read from its JSON Schema: what `create webapp --help` and `add entity --help` print. */
export const renderSchemaHelp = ({ usage, schema }) => {
  const required = new Set(schema.required || []);
  const rows = Object.entries(schema.properties || {})
    .sort(([, left], [, right]) => (left['x-order'] ?? 99) - (right['x-order'] ?? 99))
    .map(([name, property]) => {
      const flag = `${flagOf(name)} ${valueHint(property)}`.trim();
      const notes = [
        required.has(name) ? 'required' : null,
        property.default !== undefined && property.default !== ''
          ? `default ${JSON.stringify(property.default)}`
          : null,
      ].filter(Boolean);
      return `  ${flag}\n      ${property.description || ''}${notes.length ? ` (${notes.join(', ')})` : ''}`;
    });

  return [
    `Usage\n  ${usage}`,
    '',
    schema.description || '',
    '',
    'Flags',
    ...rows,
    '',
    'Add --dry-run --json to see the plan; the full schema: link-loom schema <name>.',
    '',
  ].join('\n');
};
