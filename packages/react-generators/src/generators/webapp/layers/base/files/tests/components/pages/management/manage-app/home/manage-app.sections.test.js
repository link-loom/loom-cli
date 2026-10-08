import en from "@i18n/en";
import es from "@i18n/es";
import appConfig from "@app-config";
import { ICONS } from "@constants/iconLibrary";
import { CARD_COLORS } from "@constants/theme";
import { copyAt } from "@utils/copy.utils";
import { MANAGE_APP_SECTIONS, manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";

describe("Manage the app sections", () => {
  it("name copy, icons and colours that exist", () => {
    const broken = MANAGE_APP_SECTIONS.filter(
      (section) =>
        [section.titleKey, section.descriptionKey].some((key) => copyAt(en, key) === key || copyAt(es, key) === key) ||
        !ICONS[section.icon] ||
        !CARD_COLORS[section.color]
    );

    expect(broken.map((section) => section.id)).toEqual([]);
  });

  it("puts Advanced settings and the app above each of its pages", () => {
    expect(manageAppTrail(en)).toEqual([
      { label: "Advanced settings", to: `${appConfig.basePath}/management` },
      { label: `Manage ${appConfig.name}`, to: `${appConfig.basePath}/${appConfig.slug}/home` },
    ]);
  });
});
