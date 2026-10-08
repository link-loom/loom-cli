import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { manageAppTrail } from "@components/pages/management/manage-app/home/manage-app.sections";
import ManageAppLocaleComponent from "@components/pages/management/manage-app/locale/ManageAppLocale.component";

export default function ManageAppLocalePage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.locale.title, breadcrumb: manageAppTrail(copy) });

  return (
    <>
      <ManageAppLocaleComponent />
      <OnPageLoaded />
    </>
  );
}
