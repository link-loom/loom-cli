import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppContractsComponent from "@components/pages/management/manage-app/contracts/ManageAppContracts.component";

export default function ManageAppContractsPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.contracts.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppContractsComponent />
      <OnPageLoaded />
    </>
  );
}
