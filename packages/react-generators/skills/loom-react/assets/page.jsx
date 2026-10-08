import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import ReportsStockSummaryComponent from "@components/pages/reports/stock-summary/ReportsStockSummary.component";

export default function ReportsStockSummaryPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.reports.stockSummary.title, breadcrumb: [] });

  return (
    <>
      <ReportsStockSummaryComponent />
      <OnPageLoaded />
    </>
  );
}
