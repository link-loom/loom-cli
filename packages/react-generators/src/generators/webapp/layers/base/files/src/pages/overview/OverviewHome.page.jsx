import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import OverviewHomeComponent from "@components/pages/overview/OverviewHome.component";

export default function OverviewHomePage() {
  const copy = useCopy();
  usePageMeta({ title: copy.overview.title, breadcrumb: [] });

  return (
    <>
      <OverviewHomeComponent />
      <OnPageLoaded />
    </>
  );
}
