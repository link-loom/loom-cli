import appConfig from "@app-config";
import { useCopy } from "@i18n/index";
import { iconFor } from "@constants/iconLibrary";
import { CARD_COLORS } from "@constants/theme";
import { appPath } from "@utils/paths.utils";
import HubCards from "@components/shared/hub-cards/HubCards.component";

/** The plan and the billing of this app. */
export default function ManageAppSubscriptionComponent() {
  const copy = useCopy();
  const words = copy.manageApp.subscription;
  const root = `/${appConfig.slug}/subscription`;

  const cards = [
    { id: "pricing", href: appPath(`${root}/pricing`), title: words.pricing.title, description: words.pricing.card, Icon: iconFor("store"), color: CARD_COLORS.brand },
    { id: "billing", href: appPath(`${root}/billing`), title: words.billing.title, description: words.billing.card, Icon: iconFor("billing"), color: CARD_COLORS.amber },
  ];

  return <HubCards title={words.title} subtitle={words.subtitle} cards={cards} />;
}
