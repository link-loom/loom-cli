import en from "@i18n/en";
import es from "@i18n/es";
import { ICONS } from "@constants/iconLibrary";
import { copyAt } from "@utils/copy.utils";
import { QUICK_ADD_ACTIONS, QUICK_ADD_PLACEHOLDER } from "@components/layouts/navbar/quick-add.registry";

describe("Quick add registry", () => {
  it("names copy and icons that exist", () => {
    const entries = [...QUICK_ADD_ACTIONS, QUICK_ADD_PLACEHOLDER];
    const keys = entries.flatMap((action) => [action.labelKey, action.descriptionKey]);

    expect(keys.filter((key) => copyAt(en, key) === key || copyAt(es, key) === key)).toEqual([]);
    expect(entries.filter((action) => !ICONS[action.icon])).toEqual([]);
  });
});
