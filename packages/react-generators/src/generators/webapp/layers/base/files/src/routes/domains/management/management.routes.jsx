import { lazy } from "react";
import { Route } from "react-router-dom";

const ManagementHomePage = lazy(() => import("@pages/management/ManagementHome.page"));

/** Advanced settings: the hub of cards for this app, its security and the platforms. */
export default function ManagementRoutes() {
  return <Route path="management" element={<ManagementHomePage />} />;
}
