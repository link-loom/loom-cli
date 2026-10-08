import { lazy } from "react";
import { Route } from "react-router-dom";

const OverviewHomePage = lazy(() => import("@pages/overview/OverviewHome.page"));

export default function OverviewRoutes() {
  return <Route path="overview" element={<OverviewHomePage />} />;
}
