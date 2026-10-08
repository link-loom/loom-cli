import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppPricingComponent from "@components/pages/management/manage-app/subscription/ManageAppPricing.component";

export default function ManageAppPricingPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.subscription.pricing.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppPricingComponent />
      <OnPageLoaded />
    </>
  );
}
