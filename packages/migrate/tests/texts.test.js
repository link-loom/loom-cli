import { findTexts, readTextsFromCopy } from '../src/texts.js';

const SOURCE = `import { Button } from "@mui/material";

export default function CustomerList() {
  return (
    <section>
      <h2>Customers</h2>
      <input placeholder="Search customers" aria-hidden="true" />
      <Button>{count} found</Button>
      <img alt="" src="/x.png" />
    </section>
  );
}
`;

describe('texts', () => {
  it('finds the JSX text and the text attributes people read', () => {
    expect(findTexts(SOURCE).map(({ kind, text, line }) => [kind, text, line])).toEqual([
      ['text', 'Customers', 6],
      ['attribute', 'Search customers', 7],
      ['text', 'found', 8],
    ]);
  });

  it('reads the texts with a key from the dictionaries, with useCopy and its import', () => {
    const [title, search] = findTexts(SOURCE);
    const { source: rewritten, left } = readTextsFromCopy(SOURCE, {
      [title.start]: 'identity.customer.title',
      [search.start]: 'identity.customer.search',
    });

    expect(rewritten).toContain('import { useCopy } from "@i18n/index";');
    expect(rewritten).toContain('export default function CustomerList() {\n  const copy = useCopy();');
    expect(rewritten).toContain('<h2>{copy.identity.customer.title}</h2>');
    expect(rewritten).toContain('placeholder={copy.identity.customer.search}');
    expect(rewritten).toContain('{count} found');
    expect(left).toEqual([]);
  });

  it('gives an arrow component a block, uses getCopy outside components and leaves module-level texts', () => {
    const source = `import { openSnackbar } from "@link-loom/react-sdk";

const Loader = () => (
  <span>Loading</span>
);

export const notifyCopied = (id) => {
  openSnackbar("Link copied", "success");
};

const BANNER = <strong>Beta</strong>;
`;
    const texts = findTexts(source);
    const keys = Object.fromEntries(
      texts.map((text, index) => [text.start, ['a.loading', 'a.copied', 'a.beta'][index]]),
    );
    const { source: rewritten, rewritten: starts, left } = readTextsFromCopy(source, keys);

    expect(rewritten).toContain(
      'const Loader = () => {\n  const copy = useCopy();\n  return (\n  <span>{copy.a.loading}</span>\n);\n}',
    );
    expect(rewritten).toContain(
      'export const notifyCopied = (id) => {\n  const copy = getCopy();\n  openSnackbar(copy.a.copied, "success");',
    );
    expect(rewritten).toContain('import { getCopy, useCopy } from "@i18n/index";');
    expect(rewritten).toContain('<strong>Beta</strong>');
    expect(starts).toHaveLength(2);
    expect(left.map((text) => text.text)).toEqual(['Beta']);
  });

  it('leaves the texts of a function that already has a copy of its own', () => {
    const source = `export default function Share() {
  const copy = () => navigator.clipboard.writeText("x");
  return <button onClick={copy}>Copy</button>;
}
`;
    const [text] = findTexts(source);
    const { source: rewritten, left } = readTextsFromCopy(source, { [text.start]: 'a.copy' });
    expect(rewritten).toBe(source);
    expect(left).toHaveLength(1);
  });

  it('finds labels of object literals and literals in braces, and reads module-level labels through getters', () => {
    const source = `const COLUMNS = [{ field: "name", headerName: "Name" }];

export default function Items() {
  const tabs = [{ value: "all", label: "All" }];
  return <Tabs title={"Items"}>{"Loading"}</Tabs>;
}
`;
    const texts = findTexts(source);
    expect(texts.map(({ kind, text }) => [kind, text])).toEqual([
      ['property', 'Name'],
      ['property', 'All'],
      ['expression', 'Items'],
      ['expression', 'Loading'],
    ]);

    const keys = Object.fromEntries(
      texts.map((text, index) => [text.start, ['a.name', 'a.all', 'a.items', 'a.loading'][index]]),
    );
    const { source: rewritten, left } = readTextsFromCopy(source, keys);
    expect(rewritten).toContain('{ field: "name", get headerName() {\n    return getCopy().a.name;\n  } }');
    expect(rewritten).toContain('{ value: "all", label: copy.a.all }');
    expect(rewritten).toContain('<Tabs title={copy.a.items}>{copy.a.loading}</Tabs>');
    expect(rewritten).toContain('import { getCopy, useCopy } from "@i18n/index";');
    expect(left).toEqual([]);
  });

  it('finds the texts of ternaries, `cond && "…"` and button labels', () => {
    const source = `export default function Save({ saving, error }) {
  const dialog = { confirmButtonText: "Delete", cancelButtonText: "Keep" };
  return (
    <Button title={saving ? "Saving" : "Save"}>
      {error && "Try again"}
    </Button>
  );
}
`;
    expect(findTexts(source).map(({ kind, text }) => [kind, text])).toEqual([
      ['property', 'Delete'],
      ['property', 'Keep'],
      ['expression', 'Saving'],
      ['expression', 'Save'],
      ['expression', 'Try again'],
    ]);
  });
});
