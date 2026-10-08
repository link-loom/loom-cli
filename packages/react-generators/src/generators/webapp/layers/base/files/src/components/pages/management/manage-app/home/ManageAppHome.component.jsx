import { useCopy } from "@i18n/index";
import { iconFor } from "@constants/iconLibrary";
import { CARD_COLORS } from "@constants/theme";
import { copyAt } from "@utils/copy.utils";
import { appPath } from "@utils/paths.utils";
import HubCards from "@components/shared/hub-cards/HubCards.component";
import { MANAGE_APP_SECTIONS } from "./manage-app.sections";

/** The app's own account: identity, language and theme, plan, contracts and help. */
export default function ManageAppHomeComponent() {
  const copy = useCopy();

  const cards = MANAGE_APP_SECTIONS.map((section) => ({
    id: section.id,
    href: appPath(section.to),
    title: copyAt(copy, section.titleKey),
    description: copyAt(copy, section.descriptionKey),
    Icon: iconFor(section.icon),
    color: CARD_COLORS[section.color],
  }));

  return <HubCards title={copy.manageApp.title} subtitle={copy.manageApp.subtitle} cards={cards} />;
}
