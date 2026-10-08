import { lazy } from "react";
import { Route } from "react-router-dom";

import LayoutAuth from "@layouts/LayoutAuth";

const TenancySetupPage = lazy(() => import("@pages/setup/TenancySetup.page"));
const MaintenanceGeneralPage = lazy(() => import("@pages/maintenance/MaintenanceGeneral.page"));

/** After sign-up: create, join or choose an organization (Veripass tenancy onboarding). */
export default function SetupRoutes() {
  return (
    <Route path="/setup" element={<LayoutAuth />}>
      <Route path="workspace" element={<TenancySetupPage />} />
      <Route path="*" element={<MaintenanceGeneralPage />} />
    </Route>
  );
}
