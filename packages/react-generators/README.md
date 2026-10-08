# @link-loom/react-generators

React generators for the Link Loom CLI: the `webapp` template (built from layers) and the pieces inside a webapp
(CRUD, pages, components, services, SEO…). It also ships the `loom-react` agent skill in `skills/loom-react`.

## `webapp`

The Mi Retail workspace frame on `@link-loom/react-shell`, with Veripass sign-in, Overview, Advanced settings, language
and theme, brand assets, Docker and Jest. Layers, all on by default:

| Layer            | Flag to leave it out  | Adds                                                                            |
| ---------------- | --------------------- | ------------------------------------------------------------------------------- |
| `signup`         | `--no-signup`         | Sign-up and the organization setup                                              |
| `stoneos`        | `--no-stoneos`        | Launchpad sidebar, My apps, App Store, apps menu, platform hubs and help center |
| `command-center` | `--no-command-center` | The Sommatic Command Center as a right panel, with its Omnisearch commands      |

```bash
npx link-loom create webapp --name "Acme Workspace" --variant client --json
VERIPASS_API_KEY=… npx link-loom create webapp --name "Acme Admin" --variant admin --brand-mode random --from-env --json
```

`npx link-loom schema webapp` prints every option. The stack versions the generated `package.json` uses live in
`src/stack.json`. Every app is born with one CRUD, the platform's own API keys under Advanced settings, made by
`entity` like any later one.

## `entity`

A CRUD for one entity, inside a webapp, from the record and list kit of `@link-loom/react-sdk`: the list
(`ListSurface`: search, list or grid, pagination, row actions from the standard catalog), the record as Mi Retail
shows it (title and icon in the header, properties as quiet fields in the grey band, long texts in Details; creating
is the same record before it exists), over the list (`?id=`, `?new=1`) and on its own page, a service on `BaseApi`, the
routes, the sidebar row, the Omnisearch category, the + menu entry, the en/es copy and the tests (unit and flow).

```bash
npx link-loom add entity --domain inventory --entity product \
  --fields "name:text:required,sku:text:list,price:number,status:options=active|archived" \
  --singular-es Producto --plural-es Productos --field-labels-es "name=Nombre,price=Precio,status=Estado" \
  --list standard --actions quickview,open-new-tab,copy-link,delete --custom-actions archive:call --json
```

Nothing is inferred: the list preset (`standard`, `compact`, `cards`), the row actions, the entity's own actions
(`call`, `replace`, `copy`), the scope (`organization` lists and creates within the person's organization) and where
it lives (`--section advanced` keeps it under Advanced settings) are options. `npx link-loom schema entity` prints
them all.

## License

The generators are [Apache-2.0](LICENSE). The files they write into a project belong to that project: use,
change and license them under any terms, with no attribution required.
