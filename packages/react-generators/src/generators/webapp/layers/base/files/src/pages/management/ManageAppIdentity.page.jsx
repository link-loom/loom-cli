import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppIdentityComponent from "@components/pages/management/manage-app/identity/ManageAppIdentity.component";

export default function ManageAppIdentityPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.identity.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppIdentityComponent />
      <OnPageLoaded />
    </>
  );
}
