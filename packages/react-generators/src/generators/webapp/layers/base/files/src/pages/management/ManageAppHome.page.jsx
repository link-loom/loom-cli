import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { appPath } from "@utils/paths.utils";
import ManageAppHomeComponent from "@components/pages/management/manage-app/home/ManageAppHome.component";

export default function ManageAppHomePage() {
  const copy = useCopy();
  usePageMeta({ title: copy.manageApp.title, breadcrumb: [{ label: copy.management.title, to: appPath("/management") }] });

  return (
    <>
      <ManageAppHomeComponent />
      <OnPageLoaded />
    </>
  );
}
