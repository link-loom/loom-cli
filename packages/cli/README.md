# @link-loom/cli

Create any Link Loom project with generators. Run it with:

```bash
npx @link-loom/cli
```

In a terminal it opens the interactive home; without a TTY, or with `--json`, it runs in agent mode: no prompts, one JSON
document on stdout and stable exit codes. See the monorepo README for the full contract.

```bash
npx @link-loom/cli create service --name billing-svc --shape microservice --json
npx @link-loom/cli describe --json
npx @link-loom/cli mcp            # the same commands as an MCP server over stdio
```

Long runs (`create`, `update`, `migrate apply`) report their progress on stderr: one JSON event per line with `--json`,
which `mcp` turns into `notifications/progress` when a call carries a `progressToken`. To keep working while
dependencies install, create with `--no-install` and run `npm install` in the background. The monorepo README has the
event fields and the MCP tools.

## License

[Apache-2.0](LICENSE).
