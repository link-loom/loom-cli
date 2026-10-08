---
name: loom-landing
description: Build and change Link Loom landing pages (Astro, static, English and Spanish): pages, sections, blog posts, navigation, copy, SEO and images, with the Link Loom CLI and the standard of the Mi Retail landing.
license: Apache 2.0
author: Blackwood Stone Holdings, Inc.
compatibility: Requires Astro 5, Node 22
allowed-tools: Bash(npx link-loom:*) Bash(npm run:*) Read
---

# Link Loom landing pages

A Link Loom landing is a static Astro site where every page exists in English (`/en/…`) and Spanish (`/es/…`).
Pages are thin, views are lists of sections, navigation and page titles are data, and every visible text lives in
two dictionaries with the same keys. The CLI writes each piece with that standard; this skill says how to use it.

## 0. Use the CLI first

```bash
npx link-loom describe --project --json     # layers, pages, sections, posts, navigation
npx link-loom schema section                # the exact input of a generator
npx link-loom add page --path /company --title-en Company --title-es Compañía --nav footer:company --json
npx link-loom add section --page home --kind cards --id benefits --title-en "Why teams switch" \
  --title-es "Por qué los equipos cambian" --items-en "Fast|Set up in a day." "Clear|One place for the work." \
  --items-es "Rápido|Listo en un día." "Claro|Un solo lugar para el trabajo." --icons bolt,visibility --json
npx link-loom add blog-post --slug why-one-board --title-en "Why one board" --title-es "Por qué un tablero" --json
npx link-loom add copy --key home.hero.deck --en "…" --es "…" --replace --yes --json
npm run verify                              # link-loom check, astro check and the build
```

Changing an existing file (copy, a page's section list, navigation) needs `--yes`: run with `--dry-run` first and
read the plan. A piece that exists is regenerated with `--replace --yes`.

The same commands are MCP tools: `.mcp.json` starts `npx link-loom mcp` (`add_<generator>`, `check`, `describe`,
`schema`; input = the generator's schema plus `dryRun` and `yes`).

Installing takes minutes. `npx link-loom update` reports its progress on stderr with `--json` (one JSON event per line,
`progress` from 0 to 100); over MCP a call with a `progressToken` gets `notifications/progress`. Do not wait on it:
`update --no-install`, `npm install` in the background, and keep generating, since generators only write files.
`npm run verify` waits for the install.

## 1. Where things live

| What                                  | Where                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| A page in one language                | `src/pages/<en                                                                               | es>/<path>.astro`: three lines that render its view |
| What a page shows                     | `src/views/<page>/<Name>Page.astro`, its sections in `src/views/<page>/sections/`            |
| The order of the sections             | `src/views/<page>/sections.ts` (`SECTIONS`)                                                  |
| Header menu and footer columns        | `src/data/nav.ts` (`HEADER_NAV`, `FOOTER_COLUMNS`)                                           |
| Page titles of the breadcrumb         | `src/data/pages.ts` (`PAGES`)                                                                |
| Copy                                  | `src/data/copy/en.ts`, `src/data/copy/es.ts`: `<page>.<section>.*`                           |
| Site name, address, contacts, sign-in | `src/data/site.ts`                                                                           |
| Colours, type, spacing                | `src/styles/_tokens.scss` (`--site-*`)                                                       |
| Blog posts                            | `src/content/blog/<slug>.md` and `<slug>.es.md`                                              |
| Images                                | `images.manifest.json` → `npm run gen:images` → `npm run optimize:images` → `public/images/` |

## 2. Section kinds

| Kind        | For                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `hero`      | The home's h1 (mark the highlighted words with `*asterisks*`), deck, get started and a second button |
| `page-hero` | A subpage's h1, eyebrow and deck, optionally an image                                                |
| `logos`     | A quiet band of logo tiles (`--logos "Name=/brand/x.svg"`)                                           |
| `cards`     | A head over cards with coloured icon dots; `--tone dark` is the ink band                             |
| `split`     | An image beside points with icon tiles                                                               |
| `faq`       | Questions and answers, with FAQPage structured data (`--items-en "Question\|Answer"`)                |
| `prose`     | Running text in a narrow column                                                                      |
| `final-cta` | The home's ink closing band                                                                          |
| `page-cta`  | A subpage's quiet closing card                                                                       |

## 3. The rules

1. Every visible text in both dictionaries; the Spanish written natively, neutral, with "tú".
2. No hex colours in components: `var(--site-…)` tokens only.
3. Icons from Material Design Icons through `@components/ui/Icon.astro` (`ic:baseline-…`). No emojis.
4. Semantic HTML5, one `h1` per page, headings in order, `alt` on every image.
5. Each page sets its title and description (copy `<page>.meta`), and has its other-language twin.
6. `npm run verify` passes before you finish.
