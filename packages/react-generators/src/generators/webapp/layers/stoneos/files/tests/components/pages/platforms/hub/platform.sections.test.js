import en from "@i18n/en";
import es from "@i18n/es";
import { ICONS } from "@constants/iconLibrary";
import { copyAt } from "@utils/copy.utils";
import { PLATFORM_SECTIONS } from "@components/pages/platforms/hub/platform.sections";

describe("Platform sections", () => {
  it("name copy and icons that exist", () => {
    const sections = Object.values(PLATFORM_SECTIONS).flat();
    const keys = sections.flatMap((section) => [section.titleKey, section.descriptionKey]);

    expect(keys.filter((key) => copyAt(en, key) === key || copyAt(es, key) === key)).toEqual([]);
    expect(sections.filter((section) => !ICONS[section.icon])).toEqual([]);
  });
});
