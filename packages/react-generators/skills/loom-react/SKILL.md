---
name: loom-react
description: Develop FRONTEND React components, pages, and UI logic for Link Loom web applications. Handles view rendering, user interactions, and client-side state using `@link-loom/react-sdk`.
license: Apache 2.0
author: Blackwood Stone Holdings, Inc.
compatibility: Requires React, Vite, Bootstrap 5
allowed-tools: Bash(git:*) Bash(jq:*) Read
---

# Link Loom React Development Skill

This skill standardizes frontend development for Link Loom applications, enforcing consistency in styling, structure, and code quality.

## Table of Contents

0.  [Use the CLI first](#0-use-the-cli-first)
1.  [Coding Standards](#1-coding-standards)
2.  [Naming Conventions](#2-naming-conventions)
3.  [Directory Structure](#3-directory-structure)
4.  [Styling Guidelines](#4-styling-guidelines)
5.  [Component Guidelines](#5-component-guidelines)
6.  [Forms: choosing from a list](#6-forms-choosing-from-a-list)
7.  [General Best Practices](#7-general-best-practices)
8.  [Resources & Documentation](#8-resources--documentation)
9.  [Examples](#9-examples)
10. [Edge Cases](#10-edge-cases)

---

## 0. Use the CLI first

Pieces are generated, not written by hand: the CLI writes them with the standard and registers them where they go.
Ask it what exists before you start, and what each generator takes.

```bash
npx link-loom describe --project --json   # layers, domains, entities, pages and their paths, registries
npx link-loom schema entity               # the exact input of a generator
npx link-loom add entity --domain inventory --entity product --fields name:text:required,price:number --json
npx link-loom add page --domain reports --name stock-summary --title-en "Stock summary" --title-es "Resumen de inventario" --json
npx link-loom check --json                # the rules every change must pass
npm run verify                            # lint, check, tests and build: run it before you finish
```

| You need                                                     | Command                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| A CRUD (list, record, service, routes, copy, tests)          | `add entity`                                                   |
| A page with its route                                        | `add page`                                                     |
| A component, a service, a hook                               | `add component`, `add service`, `add hook`                     |
| A sidebar row, an Advanced settings card, a platform section | `add nav-item`, `add settings-section`, `add platform-section` |
| A text in both languages                                     | `add copy`                                                     |
| Image generation and optimization                            | `add feature --name images`                                    |

A command that changes existing files answers `E_CONFIRMATION_REQUIRED` with its plan: read the plan, then repeat it
with `--yes`. If the CLI cannot make what you need, say so; do not imitate its output by hand.

The same commands are MCP tools: `.mcp.json` starts `npx link-loom mcp` (`add_<generator>`, `brand`, `check`,
`describe`, `schema`; input = the generator's schema plus `dryRun` and `yes`).

Installing takes minutes. `npx link-loom update` reports its progress on stderr with `--json` (one JSON event per line,
`progress` from 0 to 100); over MCP a call with a `progressToken` gets `notifications/progress`. Do not wait on it:
`update --no-install`, `npm install` in the background, and keep generating, since generators only write files.
`add feature` adds dependencies (install after it), and `npm run verify` waits for the install.

---

## 1. Coding Standards

- **Flat Style**: Guard clauses first, negative checks early, happy path last.
- **No Pyramid of Doom**: Avoid deep nesting.
- **Hooks Rules**: Respect hook dependencies and order.

**Bad:**

```javascript
useEffect(() => {
  if (user) {
    if (user.isActive) {
      loadData();
    }
  }
}, [user]);
```

**Good:**

```javascript
useEffect(() => {
  if (!user || !user.isActive) {
    return;
  }

  loadData();
}, [user]);
```

---

## 2. Naming Conventions

| Type             | Pattern                                                                                                   | Example                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Page             | `src/pages/<domain>/<Domain><Name>.page.jsx`                                                              | `src/pages/inventory/InventoryProductList.page.jsx`               |
| Domain component | `src/components/pages/<domain>/<entity>/{list,record,quick-actions}/<Domain><Entity><Role>.component.jsx` | `…/inventory/product/record/InventoryProductRecord.component.jsx` |
| Shared component | `src/components/shared/<name>/<Name>.component.jsx`                                                       | `src/components/shared/hub-cards/HubCards.component.jsx`          |
| Service          | `src/services/<domain>/<entity>/<domain>-<entity>.service.js`                                             | class `InventoryProductService`                                   |
| Routes           | `src/routes/domains/<domain>/<domain>[-<entity>].routes.jsx`                                              | collected on their own by `src/routes/index.js`                   |
| Hook             | `src/hooks/use<Name>.hook.js`                                                                             | `useCurrentUser.hook.js`                                          |
| Utility          | `src/utils/<name>.utils.js`                                                                               | `paths.utils.js`                                                  |
| Test             | `tests/<same path as in src>/<File>.test.jsx`                                                             | one per component, hook, service and utility                      |

- A component lives in its own folder. Suffixes are mandatory. `link-loom check` verifies all of this.

---

## 3. Directory Structure

```
src/
├── pages/<domain>/                  # one page per route: title, <OnPageLoaded />, one component
├── components/
│   ├── layouts/                     # the app's own pieces of the frame and its registries (navigation.js…)
│   ├── pages/<domain>/<entity>/     # mirrors the backend domain 1:1
│   └── shared/                      # reused components; candidates for the Link Loom SDK
├── routes/domains/<domain>/         # one routes file per domain or entity
├── services/<domain>/<entity>/      # BaseApi services
├── hooks/  utils/  constants/  i18n/
tests/                               # Jest, mirroring src/
```

---

## 4. Styling Guidelines

**Order of styling priority (STRICT):**

1. **Bootstrap 5 classes**: `d-flex`, `justify-content-between`, `align-items-center`, `p-3`, `m-2`, `w-100`.
2. **Standard MUI or Link Loom SDK components**: `List`, `ListItemButton`, `ListItemIcon` (NO custom styled wrappers for layout).
3. **Styled-components**: Only if Bootstrap and the components above do not cover the style you need.
4. **Inline styles**: Last resort, only if strictly necessary.

- **Layout**: `row`, `col-12`, `col-md-6`, `d-flex`, `justify-content-between`, `align-items-center`, `my-4`, `p-3`, and so on. Do not use MUI Grid.
- **Components**: Primarily use MUI components or Link Loom SDK components. Only build custom components when neither has what you need.
- **Typography**: `h1`, `p`, `text-muted`, `fw-bold`, and so on. Avoid MUI Typography.
- **Avoid**: Custom CSS for layout. Use custom classes only for design tokens (colors, branding) not covered by Bootstrap.
- **Icons**: Import ONLY from `@mui/icons-material`, aliased with the `Icon` suffix:

```javascript
import { AccountCircle as AccountCircleIcon } from '@mui/icons-material';
```

---

## 5. Component Guidelines

### Structure (Mandatory)

All components **MUST** follow this internal structure, section by section. Use the templates in `assets/` and fill in the blanks; **DO NOT** invent your own structure.

```javascript
export function MyComponent({ prop1 }) {
  // -----------------------------------------------------
  // 1. Hooks
  // -----------------------------------------------------
  const navigate = useNavigate();

  // -----------------------------------------------------
  // 2. Models / State
  // -----------------------------------------------------
  const [entities, setEntities] = useState([]);

  // -----------------------------------------------------
  // 3. UI States
  // -----------------------------------------------------
  const [loading, setLoading] = useState(true);

  // -----------------------------------------------------
  // 4. Configs / Constants
  // -----------------------------------------------------
  const GRID_SIZE = 12;

  // -----------------------------------------------------
  // 5. Component Functions
  // -----------------------------------------------------

  // Entry Point
  const initializeComponent = async () => {
    // implementation...
  };

  // Event Handlers
  const itemOnAction = (action, entity) => {
    // implementation...
  };

  // -----------------------------------------------------
  // 6. Lifecycle
  // -----------------------------------------------------
  useEffect(() => {
    initializeComponent();
  }, []);

  // -----------------------------------------------------
  // 7. Render
  // -----------------------------------------------------
  return <div className="container-fluid">{/* Content */}</div>;
}
```

### Domain Driven Design (DDD) & Parity

**CRITICAL**: Frontend structure **MUST** mirror the backend domain structure 1:1.

- If backend is `workflow-orchestration/control-plane/flow-design/flow-definition`, frontend **MUST** be `src/components/pages/workflow-orchestration/control-plane/flow-design/flow-definition`.
- Never disconnect a component from its domain.

### Pages

- **Role**: orchestration only, no business logic: `usePageMeta({ title, breadcrumb })`, one component, `<OnPageLoaded />`.
- The component draws the page with the kit: `PageShell` and `PageHeader` from `@link-loom/react-sdk`, the content in
  the Bootstrap grid.

### Records and lists

Records and lists come from the kit of `@link-loom/react-sdk`, never from a hand-made modal, table or form. `add entity`
writes them; read `src/components/pages/security/api-key/` to see how.

- **List**: `ListSurface` (search, list or grid, pagination, the four states: loading, error with retry, empty, empty
  because of the filters) with `useListState`, `useListSearch`, `useDataQuery`. Row actions come from `rowActionItems`
  (quickview, edit, open-page, open-new-tab, copy-id, copy-link, delete).
- **Record**: `EntityRecordDialog` over the list (`?id=`, `?new=1`, driven by `useEntityRoute`) and the same record on
  its own page. One `renderRecord` reads and edits: there is no separate preview and edit form.
- **Creating is the record before it exists**: the same `EntityDetailShell`, with Create instead of Save.
- **The record looks like Mi Retail's**: its title in the header as a quiet `InputBase` (class `stos-record-title`)
  beside its icon; the short properties as quiet fields in the grey band; the long texts in a Details tab; changes
  saved with `useDirtyState` and `DirtyStateFooter`.

### Services

- Extend `BaseApi` from `@link-loom/react-sdk` and answer data or throw, through `resultOf` / `pageOf` / `recordOf` of
  `@utils/response.utils`: `list`, `read`, `add`, `edit`, `remove`.
- Never call `axios` or `fetch` from a component.

```javascript
const query = useDataQuery(() => service.list({ search: list.values.text, ...list.pagination }), [list.key]);
```

---

## 6. Forms: choosing from a list

Any field in a **create or edit form** where the user picks from a list of records —
workspace, project, type, status, assignee, person, team, label, category, parent —
**MUST** be an **autocomplete**, never a bare `Select` or a native `<select>`.

```jsx
// Correct
<Autocomplete options={types} getOptionLabel={(option) => option.title} … />

// Wrong
<Select>{types.map((type) => <MenuItem …>)}</Select>
```

Why: these lists grow. A picker that is fine with four options is unusable at forty,
and every one of these lists ends up longer than its first version. Typing to narrow
is the only interaction that survives that growth.

Rules that go with it:

- **Load the options when the control opens, not on the first keystroke.** A picker that
  fetches nothing until the user types shows an empty list on focus, which reads as
  "there is nothing here". Load once, open on focus, narrow as the user types.
- **Distinguish a failed load from an empty result.** "Could not load" and "no matches"
  are different answers; rendering both as an empty list hides outages.
- **Reset the loading state when the input is cleared**, or the control sticks on
  "Searching…" forever.
- **Do not limit the options to a hardcoded subset** when the real catalogue lives in a
  service. Ask the service; fall back to the built-ins only when it is unreachable.
- Show each option the way its owning product shows it — the same label, icon and
  colour — so the same record does not look like two different things in two screens.

---

## 7. General Best Practices

- **Language**: **English ONLY** for code and static text, unless explicitly requested otherwise by the user.
- **Documentation**: **NO JSDoc** for simple functional components. Document only complex algorithms. Code should be self-documenting.
- **KISS Principle**: If a process is simple, keep the code simple. Avoid overengineering.
- **Naming**: Use semantic variable names. **NEVER** use single-letter names like `x`, `ac`, `t`. Names must indicate intent.
- **Clean Code**: Remove unused imports, dependencies, and functions. No dead code.
- **Git**: Use **Conventional Commits** if asked to generate commit messages.
- **Design Patterns**: Use patterns (Factory, Singleton, Proxy, etc.) **only** when they solve a specific problem.
- **Context**: Do not infer if unsure. Ask for clarification when requirements are not clear. Challenge requests that lead to antipatterns.
- **Linting**: **MANDATORY**. Code must follow the project's linter configuration (e.g., `.prettierrc`, `eslint.config.js`).

---

## 8. Resources & Documentation

**CRITICAL**: Do not reinvent UI components. Check the Link Loom React SDK first.

- **Component Index**: `link-loom/github/link-loom-react-sdk/src/index.js`
  - Contains exports for `Alert`, `DataGrid`, `TextEditor`, `OnPageLoaded`, etc.
- **Component Source**: `link-loom/github/link-loom-react-sdk/src/components/`

Read the index to see the available components before creating new ones.

---

## 9. Examples

- Page: `assets/page.jsx`
- Component written by hand: `assets/component.jsx`
- Service: `assets/service.js`
- A whole CRUD: `src/components/pages/security/api-key/` in this project, made by `add entity`.

---

## 10. Edge Cases

- **Mobile Responsiveness**: Always test layout with `col-12` for mobile and `col-md-*` for desktop.
- **Missing Aliases**: If `@components` or `@services` fail, check `vite.config.js`. Use relative paths temporarily if aliases are broken, but flag them for a fix. Do not import directly from `src` except for a subcomponent of the current component.
- **Async Errors**: Always wrap async operations in `try-catch` inside `useEffect` or event handlers to prevent unhandled promise rejections.
