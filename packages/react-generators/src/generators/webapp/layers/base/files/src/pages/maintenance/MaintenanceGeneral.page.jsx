import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import MaintenanceGeneralComponent from "@components/pages/maintenance/MaintenanceGeneral.component";

export default function MaintenanceGeneralPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.maintenance.title, breadcrumb: [] });

  return (
    <>
      <MaintenanceGeneralComponent />
      <OnPageLoaded />
    </>
  );
}
