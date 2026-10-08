import { OnPageLoaded } from "@link-loom/react-sdk";

import AppEngineRuntimeComponent from "@components/pages/stoneos/runtime/AppEngineRuntime.component";

// The app sets its own title and breadcrumb through the runtime.
export default function AppEngineRuntimePage() {
  return (
    <>
      <AppEngineRuntimeComponent />
      <OnPageLoaded />
    </>
  );
}
