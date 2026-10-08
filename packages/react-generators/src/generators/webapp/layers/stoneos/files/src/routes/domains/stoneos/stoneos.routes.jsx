import { lazy } from "react";
import { Route } from "react-router-dom";
import { stoneOSLaunchpadRoutes } from "@link-loom/cloud-sdk";

const AppEngineRuntimePage = lazy(() => import("@pages/stoneos/AppEngineRuntime.page"));

/** My apps and the App Store (from the cloud SDK), and the full screen an app opens in. */
export default function StoneOSRoutes() {
  return (
    <>
      {stoneOSLaunchpadRoutes()}
      <Route path="app-engine/runtime/:appSlug/*" element={<AppEngineRuntimePage />} />
    </>
  );
}
