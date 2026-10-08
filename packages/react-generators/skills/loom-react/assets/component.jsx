import { useMemo } from "react";
import { EmptyState, PageHeader, PageShell, useDataQuery } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import { iconElement } from "@constants/iconLibrary";
import ReportsSnapshotService from "@services/reports/snapshot/reports-snapshot.service";

/** The latest stock snapshots, one card each. */
export default function ReportsStockSummaryComponent() {
  // -----------------------------------------------------
  // 1. Hooks
  // -----------------------------------------------------
  const copy = useCopy();
  const service = useMemo(() => new ReportsSnapshotService(), []);
  const query = useDataQuery(() => service.list({ pageSize: 12 }), []);

  // -----------------------------------------------------
  // 4. Configs / Constants
  // -----------------------------------------------------
  const pageCopy = copy.reports.stockSummary;

  // -----------------------------------------------------
  // 7. Render
  // -----------------------------------------------------
  return (
    <PageShell width="default">
      <PageHeader icon={iconElement("chart")} title={pageCopy.title} description={pageCopy.description} />
      {!query.loading && query.items.length === 0 ? (
        <EmptyState illustration="inbox" title={pageCopy.emptyTitle} description={pageCopy.emptyDescription} />
      ) : (
        <section className="row g-3">
          {query.items.map((snapshot) => (
            <article key={snapshot.id} className="col-12 col-md-6 col-xl-4">
              {snapshot.name}
            </article>
          ))}
        </section>
      )}
    </PageShell>
  );
}
