# Link Loom CLI

Create any Link Loom project — a landing page, a webapp (client or admin), a backend monolith or a microservice —
from generators with fixed standards. Built first for AI agents (a machine contract, JSON output, stable exit codes),
with a real interactive terminal UI for people.

```bash
npx @link-loom/cli
```

## Status

| Project type            | Command                                                                  | Status    |
| ----------------------- | ------------------------------------------------------------------------ | --------- |
| Backend monolith        | `create service --shape monolith`                                        | available |
| Microservice            | `create service --shape microservice`                                    | available |
| Webapp (client / admin) | `create webapp --variant client\|admin`, then `add entity` for each CRUD | available |
| Landing page (Astro)    | `create landing`, then `add page`, `add section`, `add blog-post`        | available |
| StoneOS app             | —                                                                        | planned   |

## For agents

Agent mode is the default without a TTY, and also with `--json`, `CI` or `LINK_LOOM_MODE=agent`. It never prompts.

```bash
npx @link-loom/cli describe --json              # what the CLI can do, exit codes, error codes
npx @link-loom/cli schema service --json        # JSON Schema of a generator's input
npx @link-loom/cli create service --name billing-svc --shape microservice --dry-run --json
npx @link-loom/cli create service --input service.json --json
npx @link-loom/cli create webapp --name "Acme Workspace" --variant client --json
npx @link-loom/cli add entity --domain inventory --entity product --fields name:text:required,price:number --json
npx @link-loom/cli create landing --name Acme --description "The operations center for your business." --json
npx @link-loom/cli add section --page home --kind faq --items-en "Is it free?|Yes, for small teams." --yes --json
```

Inside a project (the folder with `loom.json`), `add`, `brand`, `services` and `images` act on it. A command that would
change existing files answers `E_CONFIRMATION_REQUIRED` with the plan until it gets `--yes`.

With `--json`, stdout carries exactly one document:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "create service",
  "dryRun": false,
  "project": {},
  "input": {},
  "plan": { "create": [], "modify": [], "delete": [] },
  "warnings": [],
  "errors": [],
  "next": []
}
```

| Exit code | Meaning                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| 0         | success (including a dry run)                                                    |
| 1         | runtime failure (`E_IO`, `E_FETCH`, `E_INSTALL`)                                 |
| 2         | usage or validation (`E_USAGE`, `E_VALIDATION` with the `missing` fields)        |
| 3         | precondition or conflict (`E_TARGET_EXISTS`, `E_NOT_AVAILABLE`, `E_EDIT_SHAPE`…) |
| 4         | quality gate failed                                                              |
| 130       | interrupted                                                                      |

### Progress of long runs

`create`, `update` and `migrate apply` install dependencies, which takes one to three minutes. While they run they
report their progress on **stderr**, so stdout keeps its single document. With `--json` it is one JSON event per line:

```jsonl
{"event":"progress","command":"create webapp","step":"render","progress":0,"total":100,"message":"Preparing the template"}
{"event":"progress","command":"create webapp","step":"write","progress":2,"total":100,"message":"Writing the files"}
{"event":"progress","command":"create webapp","step":"install","progress":27,"total":100,"message":"Installing dependencies: working out which packages it needs (400 found)","phase":"resolving","found":400}
{"event":"progress","command":"create webapp","step":"install","progress":72,"total":100,"message":"Installing dependencies: 512/1203 packages in place","phase":"installing","done":512,"packages":1203}
{"event":"progress","command":"create webapp","step":"done","progress":100,"total":100,"message":"Done"}
```

| Field      | Meaning                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `step`     | `create`: render, write, install · `update`: write, install, verify · `migrate apply`: write, install, finish; then `done`       |
| `progress` | the whole run, 0 to 100; it only grows                                                                                           |
| `phase`    | install only: `resolving` (npm is working out the tree, `found` packages so far) or `installing` (`done` of `packages` in place) |
| `message`  | the same line a person reads                                                                                                     |

Without `--json` the same progress is a readable line every 10% (`›  72% Installing dependencies: 512/1203 packages in
place`). A dry run reports nothing. `describe --json` publishes this contract under `progress`.

### Not waiting on the install

An agent does not have to sit through the install. Create with `--no-install` (`install: false` over MCP), which
answers in seconds with the project written, then install in the background and keep working on the code:

```bash
npx @link-loom/cli create webapp --name "Acme Workspace" --variant client --no-install --json
(cd acme-workspace && npm install > npm-install.log 2>&1 &)   # or the agent's own background shell
cd acme-workspace
npx @link-loom/cli add entity --domain inventory --entity product --fields name:text:required --yes --json
```

Without the install, the `next` of a create lists `npm install` right after the `cd`. Generators only write files, so
`add …` works before `node_modules` exists (`add feature` adds dependencies: run it before installing, or install
again after it). Until the install ends, call the CLI as `npx @link-loom/cli`: the project's own `npx link-loom`
arrives with its dependencies. What needs them (`npm run verify`, `check`, the build, the tests) waits for the install
to finish. `update --no-install` and `migrate apply --no-install` work the same way: run `npm install`, then what their
`next` says.

### MCP

`link-loom mcp` serves the same commands as a [Model Context Protocol](https://modelcontextprotocol.io) server over
stdio. Every generated project connects it in `.mcp.json`; to create projects from an agent, add it once yourself:

```json
{ "mcpServers": { "link-loom": { "command": "npx", "args": ["-y", "@link-loom/cli", "mcp"] } } }
```

| Where the server runs | Tools                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| outside a project     | `describe`, `schema`, `check`, and `create_landing`, `create_webapp`, `create_service`       |
| inside a project      | `describe`, `schema`, `check`, `add_<generator>` for its collection, and `brand` in a webapp |

A tool's input is its generator's JSON Schema plus `dryRun`, and `yes` (to change existing files) or `install` (on a
create). Each call runs the same dispatcher as `--json`: the result is the same document, as text and as
`structuredContent`, and `isError` is true when the exit code is not 0.

A `tools/call` that carries `params._meta.progressToken` gets `notifications/progress` while it runs, built from the
events above:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "create-1",
    "progress": 72,
    "total": 100,
    "message": "Installing dependencies: 512/1203 packages in place"
  }
}
```

The result is what marks the end of a call: a client may drop the last notification (100, `Done`) when it arrives
together with the result. Most MCP clients wait for the result of a call, so a create with the install holds the agent
for those minutes even with progress. Prefer `install: false` and the background install above when the agent has more to do.

## For people

`npx @link-loom/cli` in a terminal opens the home: the woven Link Loom logo, Loomi, and "What do you want to create?".
Every flow shows the plan before writing anything, shows the install as a bar with its percentage (Ctrl+C stops it
and says how to remove or finish the half-made folder) and ends with the equivalent command for an agent. The UI follows
the terminal language (English or Spanish) and stays static with `--no-animation`, `NO_COLOR`, `CI` or a narrow terminal.

## Packages

| Package                                                    | Role                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`@link-loom/cli`](packages/cli)                           | The runner: TUI, agent mode, commands                                                  |
| [`@link-loom/devkit`](packages/devkit)                     | The engine: virtual tree, plans, atomic apply, templates, structural edits, validation |
| [`@link-loom/node-generators`](packages/node-generators)   | Backend generators                                                                     |
| [`@link-loom/react-generators`](packages/react-generators) | React generators and the `loom-react` agent skill                                      |
| [`@link-loom/astro-generators`](packages/astro-generators) | Landing page generators                                                                |
| [`@link-loom/migrate`](packages/migrate)                   | Temporary: moves existing webapps onto the standard (`link-loom migrate`)              |

Generators follow the collection contract in [docs/collections.md](docs/collections.md).

## Development

```bash
npm install
npm test        # Jest, every package
npm run lint
node packages/cli/bin/link-loom.js describe
```

## Release

All packages share one version. `npm run version-patch` bumps every package, commits, tags `v<version>` and pushes the
tag; GitHub Actions then publishes to npm with trusted publishing (no token). Prerelease versions go to the `next` tag.
A release also moves the `@link-loom/cli` range that generated projects get to the new version; `node
scripts/release.mjs patch --no-push` does all of it but the push. `npm run version-tag` tags the version already in
`package.json` on the current commit, without bumping or pushing (for a version committed without its tag);
`git push origin v<version>` then publishes it.

## License

[Apache-2.0](LICENSE). What the generators write into your project is yours: use, change and license the generated
files under any terms you choose, with no attribution required.
