import en from "@i18n/en";
import es from "@i18n/es";
import { ICONS } from "@constants/iconLibrary";
import { copyAt } from "@utils/copy.utils";
import { NAVIGATION } from "@components/layouts/sidebar/navigation";

const keysOf = (entry) => [entry.labelKey, entry.sectionKey, ...(entry.items || []).map((item) => item.labelKey)].filter(Boolean);

describe("navigation", () => {
  it("names only copy that exists in both languages", () => {
    const keys = NAVIGATION.flatMap(keysOf);

    expect(keys.filter((key) => copyAt(en, key) === key || copyAt(es, key) === key)).toEqual([]);
  });

  it("uses only icons of the icon library and unique ids", () => {
    expect(NAVIGATION.filter((entry) => !ICONS[entry.icon]).map((entry) => entry.id)).toEqual([]);
    expect(new Set(NAVIGATION.map((entry) => entry.id)).size).toBe(NAVIGATION.length);
  });
});
