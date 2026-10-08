import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import HelpCenterComponent from "@components/pages/help-center/HelpCenter.component";

export default function HelpCenterPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.helpCenter.title });

  return (
    <>
      <HelpCenterComponent />
      <OnPageLoaded />
    </>
  );
}
