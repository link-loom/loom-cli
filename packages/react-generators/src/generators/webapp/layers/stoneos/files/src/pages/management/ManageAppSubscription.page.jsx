import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppSubscriptionComponent from "@components/pages/management/manage-app/subscription/ManageAppSubscription.component";

export default function ManageAppSubscriptionPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.subscription.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppSubscriptionComponent />
      <OnPageLoaded />
    </>
  );
}
