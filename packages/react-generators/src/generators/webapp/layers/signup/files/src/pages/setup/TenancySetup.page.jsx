import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import TenancySetupComponent from "@components/pages/setup/tenancy-setup/TenancySetup.component";

export default function TenancySetupPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.setup.title });

  return (
    <>
      <TenancySetupComponent />
      <OnPageLoaded />
    </>
  );
}
