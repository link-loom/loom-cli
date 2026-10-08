# Working on the Link Loom CLI

- This is an npm workspaces monorepo (ESM, Node >= 22, plain JavaScript). Packages live in `packages/`.
- `@link-loom/devkit` is the engine. Generators never write to disk directly: they record changes in a `VirtualTree`;
  the CLI applies it with `applyTree` (atomic, with rollback) or returns the plan on `--dry-run`.
- Edits are structural (JSON, dotenv, AST). Never replace strings blindly; if a file does not have the expected shape,
  throw `E_EDIT_SHAPE` with instructions instead of guessing.
- Every generator declares its input as a JSON Schema (draft 2020-12) in its collection's `collection.json`. The same
  schema drives flag validation, `schema`, `describe`, the TUI wizard (`x-prompt`, `x-order`) and the MCP tools.
- Agent mode must stay deterministic: one JSON document on stdout, progress and logs on stderr, the documented exit
  codes. Long runs report through `progressReporter` (`packages/cli/src/cli/progress.js`), which MCP turns into
  `notifications/progress`.
- Tests are Jest, in `tests/` at the root of each package (never `__tests__`): one test file per source file.
- Before finishing: `npm run lint && npm test`.
- Do not publish, tag or push. Releases are done by the maintainer with `npm run version-patch`.
