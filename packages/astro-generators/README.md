# @link-loom/astro-generators

Astro generators for the Link Loom CLI: the `landing` template and its pieces.

| Generator   | What it writes                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landing`   | The Mi Retail landing frame (header, footer, language, sticky call to action, SEO and structured data) in English and Spanish, the home's hero and closing call to action, contact and legal pages, brand files and the image pipeline. Layers: `blog`, `search` (Pagefind), `editor` (development only) |
| `page`      | A page in both languages: its view (hero and closing call to action), breadcrumb title, copy and menu or footer entry                                                                                                                                                                                    |
| `section`   | A section of a page from the standard kinds: hero, page-hero, logos, cards, split, faq, prose, final-cta, page-cta                                                                                                                                                                                       |
| `blog-post` | A post in English and Spanish, parallel by `base_slug`                                                                                                                                                                                                                                                   |
| `copy`      | One text in both dictionaries, or a new value for an existing one (`--replace`)                                                                                                                                                                                                                          |

`link-loom check` runs the landing rules (structure, mirrored pages, links, sections, copy, copy parity, colour
tokens, images, secrets); `link-loom describe --project` lists pages with their sections, navigation and posts.

## License

The generators are [Apache-2.0](LICENSE). The files they write into a project belong to that project: use,
change and license them under any terms, with no attribution required.
