# @link-loom/migrate

Temporary. Moves an existing Link Loom webapp (built from the old Adminto-based template) onto the generated
standard, in a new folder; the legacy repo is only read. It lives two or three releases and is then removed.

```bash
npx link-loom migrate analyze ../my-legacy-app          # writes migration.decisions.json and prints what to decide
npx link-loom migrate apply --decisions migration.decisions.json --out ../my-app   # builds, installs and finishes
cd ../my-app && npm run verify
```

`analyze` reads the app: routes and the pages they render, the files the app runs (the old shell, barrels and dead
code are proposed for discarding), services, sidebar rows, texts written in components, the brand and the public
files the code uses. It writes a draft of every decision. A person or an agent finishes it: names and domains, the
Spanish of every text, which lists and records to rebuild with the kit (`entities`, as `add entity` inputs).

`apply` creates the webapp with the project decisions, rebuilds the entities with the kit, carries every file decided
`move` to its place (texts read from the dictionaries, imports pointed at the new layout, the legacy outlet context
replaced by `usePageMeta`, colour literals read from the theme), mounts the pages on their routes, adds the sidebar
rows, merges the legacy theme, copies the public files the code uses, writes a first test for each carried file and
leaves `MIGRATION.md` with what is still pending. Texts inside components and hooks read `useCopy()`; texts inside
other functions read `getCopy()`; imported names and `catch` bindings the carried code no longer reads are dropped.

`finish` runs after `npm install` (`apply` calls it unless `--no-install`; `migrate finish [dir]` runs it again):
it formats the carried files with the project's prettier, applies eslint's fixes and turns off, per file and per rule,
the lint the legacy code still fails, with a comment that says so. The `link-loom check` rules a carried file still
fails go to `loom.json` (`migration.waivers`): `check` reports them without failing. Both lists are in
`MIGRATION.md`; each run drops what was fixed meanwhile. New code gets no waiver.

## License

[Apache-2.0](LICENSE).
