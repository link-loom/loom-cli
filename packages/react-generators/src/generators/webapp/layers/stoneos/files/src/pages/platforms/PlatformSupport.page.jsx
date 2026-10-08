import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import usePlatform from "@hooks/usePlatform.hook";
import { appPath } from "@utils/paths.utils";
import HelpCenterComponent from "@components/pages/help-center/HelpCenter.component";
import MaintenanceGeneralComponent from "@components/pages/maintenance/MaintenanceGeneral.component";

export default function PlatformSupportPage() {
  const copy = useCopy();
  const { platform, labels } = usePlatform();
  usePageMeta({
    title: copy.helpCenter.title,
    breadcrumb: [
      { label: copy.management.title, to: appPath("/management") },
      ...(platform ? [{ label: labels.capability, to: appPath(`/platforms/${platform.id}`) }] : []),
    ],
  });

  return (
    <>
      {platform ? (
        <HelpCenterComponent namespaceSlug={platform.supportNamespaceSlug} productSlug={platform.id} productDisplayName={labels.name} />
      ) : (
        <MaintenanceGeneralComponent />
      )}
      <OnPageLoaded />
    </>
  );
}
