# @link-loom/devkit

The engine behind Link Loom generator collections:

- `VirtualTree`: records file changes in memory against a real folder, so every generator can run as a dry run.
- `applyTree`: commits a tree atomically (staging, backups, rollback on failure).
- `renderDirectory`: renders a template folder (`.ejs` files and `__name__` path tokens).
- `mergeJson`, `setJsonPath`, `setDotenv`: structural edits, never blind string replacement.
- `loadCollection`, `validateOptions`: reads a `collection.json` and validates generator input against its JSON Schema.
- `LoomError`, `EXIT_CODES`: the error codes and exit codes shared by the CLI and the MCP server.

See `docs/collections.md` in the monorepo for the collection contract.

## License

[Apache-2.0](LICENSE).
