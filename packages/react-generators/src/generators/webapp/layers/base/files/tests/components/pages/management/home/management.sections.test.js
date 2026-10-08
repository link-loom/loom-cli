import en from "@i18n/en";
import es from "@i18n/es";
import { ICONS } from "@constants/iconLibrary";
import { CARD_COLORS } from "@constants/theme";
import { copyAt } from "@utils/copy.utils";
import { MANAGEMENT_SECTIONS } from "@components/pages/management/home/management.sections";

describe("Advanced settings sections", () => {
  it("name copy, icons and colours that exist", () => {
    const broken = MANAGEMENT_SECTIONS.filter(
      (section) =>
        [section.titleKey, section.descriptionKey].some((key) => copyAt(en, key) === key || copyAt(es, key) === key) ||
        !ICONS[section.icon] ||
        !CARD_COLORS[section.color]
    );

    expect(broken.map((section) => section.id)).toEqual([]);
  });
});
