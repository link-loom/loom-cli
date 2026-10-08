import en from "@i18n/en";
import es from "@i18n/es";
import { ICONS } from "@constants/iconLibrary";
import { copyAt } from "@utils/copy.utils";
import { OMNISEARCH_CATEGORIES, OMNISEARCH_COMMANDS } from "@components/layouts/navbar/omnisearch.registry";

describe("Omnisearch registry", () => {
  it("names copy and icons that exist, with unique ids and shortcuts", () => {
    const entries = [...OMNISEARCH_CATEGORIES, ...OMNISEARCH_COMMANDS];

    expect(entries.filter((entry) => copyAt(en, entry.labelKey) === entry.labelKey || copyAt(es, entry.labelKey) === entry.labelKey)).toEqual([]);
    expect(entries.filter((entry) => !ICONS[entry.icon])).toEqual([]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(OMNISEARCH_COMMANDS.map((command) => command.shortcut)).size).toBe(OMNISEARCH_COMMANDS.length);
  });
});
