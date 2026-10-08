import { lazy } from "react";
import { Route } from "react-router-dom";
import { supportCenterChildRoutes } from "@link-loom/cloud-sdk";

const PlatformHubPage = lazy(() => import("@pages/platforms/PlatformHub.page"));
const PlatformSupportPage = lazy(() => import("@pages/platforms/PlatformSupport.page"));

/** A page per platform of Advanced settings, with its own help center. */
export default function PlatformsRoutes() {
  return (
    <Route path="platforms/:platformId">
      <Route index element={<PlatformHubPage />} />
      <Route path="support" element={<PlatformSupportPage />}>
        {supportCenterChildRoutes()}
      </Route>
    </Route>
  );
}
