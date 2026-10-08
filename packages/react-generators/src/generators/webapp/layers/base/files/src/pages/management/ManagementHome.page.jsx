import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import ManagementHomeComponent from "@components/pages/management/home/ManagementHome.component";

export default function ManagementHomePage() {
  const copy = useCopy();
  usePageMeta({ title: copy.management.title, breadcrumb: [] });

  return (
    <>
      <ManagementHomeComponent />
      <OnPageLoaded />
    </>
  );
}
