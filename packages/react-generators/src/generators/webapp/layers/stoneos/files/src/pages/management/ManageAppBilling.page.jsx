import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppBillingComponent from "@components/pages/management/manage-app/subscription/ManageAppBilling.component";

export default function ManageAppBillingPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.subscription.billing.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppBillingComponent />
      <OnPageLoaded />
    </>
  );
}
