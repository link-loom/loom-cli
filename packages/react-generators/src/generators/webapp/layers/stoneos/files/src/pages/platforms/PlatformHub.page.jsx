import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import usePlatform from "@hooks/usePlatform.hook";
import { appPath } from "@utils/paths.utils";
import PlatformHubComponent from "@components/pages/platforms/hub/PlatformHub.component";
import MaintenanceGeneralComponent from "@components/pages/maintenance/MaintenanceGeneral.component";

export default function PlatformHubPage() {
  const copy = useCopy();
  const { labels } = usePlatform();
  usePageMeta({ title: labels?.capability || copy.maintenance.title, breadcrumb: [{ label: copy.management.title, to: appPath("/management") }] });

  return (
    <>
      {labels ? <PlatformHubComponent /> : <MaintenanceGeneralComponent />}
      <OnPageLoaded />
    </>
  );
}
