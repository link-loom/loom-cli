# The collection contract

A collection is an npm package with a `collection.json` at its root:

```json
{
  "name": "@link-loom/node-generators",
  "generators": {
    "service": {
      "factory": "./src/generators/service/index.js",
      "schema": "./src/generators/service/schema.json",
      "description": "A Link Loom backend service (monolith or microservice) on @link-loom/sdk",
      "status": "available"
    }
  }
}
```

- `status` is `available` or `planned`. A planned generator is listed by `describe` and answers `E_NOT_AVAILABLE`.
- `schema` is a JSON Schema (draft 2020-12). `x-prompt` (a string or `{ en, es }`) marks the fields the TUI asks for,
  `x-order` sorts them, `default` fills them, and `additionalProperties: false` rejects unknown flags.
- `factory` default-exports `async (tree, options, context) => outcome`:
  - `tree` is a `VirtualTree` rooted at the working directory; record every change in it.
  - `options` is the validated input (defaults applied, CLI strings coerced).
  - `context.templateDir` overrides the template source (local development and tests).
  - `context.project` is the project's `loom.json` when the generator runs inside a project (`add`, `brand`), and
    `context.directory` points it at a project folder inside the tree (how `create webapp` adds its first entity).
  - `outcome` is `{ project, warnings, next, installIn? }`. `installIn` asks the CLI to run `npm install` there.

## Quality rules and inventory

Two optional keys make a collection's projects checkable and describable:

```json
{ "check": "./src/check/index.js", "inventory": "./src/inventory.js" }
```

- `check` exports `RULES`: `[{ id, severity: 'error' | 'warning', summary, run(project) → [{ file, line?, message }] }]`.
  `link-loom check` runs them; `project` gives `files`, `targets` (all, or the changed ones with `--changed`), `read`,
  `exists`, `ast` (parsed with `@babel/parser`) and `manifest`. Any error exits with code 4 and `E_CHECK_FAILED`.
- `inventory` exports `inventoryOf(project)`, which answers what the project holds (layers, domains, entities, pages
  and their paths, registries). `link-loom describe --project` returns it with the generators that can be added.

## Templates

`renderDirectory(dir, data)` turns a template folder into files: files without `.ejs` are copied byte for byte (so the
template stays valid source code), `.ejs` files are rendered with `data`, `__name__` tokens in paths are replaced by
`data.name`, and `_gitignore`/`_npmrc`/`_prettierrc` become dotfiles.

## Versions

`create` runs the collections bundled with the CLI. Inside a project, generators will run the collection version the
project pins in its `devDependencies`, so every project generates with its own conventions.
