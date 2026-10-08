import { lazy } from "react";
import { Route } from "react-router-dom";
import { supportCenterChildRoutes } from "@link-loom/cloud-sdk";

const HelpCenterPage = lazy(() => import("@pages/help-center/HelpCenter.page"));

/** The app's help center: guides, cases and the assistant. */
export default function HelpCenterRoutes() {
  return (
    <Route path="help-center" element={<HelpCenterPage />}>
      {supportCenterChildRoutes()}
    </Route>
  );
}
