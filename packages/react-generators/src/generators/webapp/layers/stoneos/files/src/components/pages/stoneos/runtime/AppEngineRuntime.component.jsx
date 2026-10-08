import { useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppEngineSDKProvider, AppRuntimeHostComponent, useAppEngineSDK } from "@link-loom/cloud-sdk";

import useAppRuntimeIdentity from "@hooks/useAppRuntimeIdentity.hook";
import { appPath } from "@utils/paths.utils";

const EMPTY_PAYLOAD = {};

function AppEngineRuntimeInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSlug, "*": routePath = "" } = useParams();
  const { appSessionService } = useAppEngineSDK();
  const runtimeIdentity = useAppRuntimeIdentity();

  // The app routes itself once it runs: later changes of the URL tail must not restart its session.
  const initialRoutePath = useRef(`/${routePath}`);
  const initialInputPayload = useRef(location.state?.inputPayload || EMPTY_PAYLOAD);

  // Back to wherever the person came from; on a direct load, to the app's home.
  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate(appPath("/stoneos/apps"));
  }, [navigate]);

  const handleSubmitOutput = useCallback(
    (payload) => {
      window.dispatchEvent(new CustomEvent("sommatic:app:output", { detail: { appSlug, outputPayload: payload } }));
      goBack();
    },
    [appSlug, goBack]
  );

  const handleRouteChange = useCallback(
    (path) => window.dispatchEvent(new CustomEvent("sommatic:app:fullscreen-route-change", { detail: { appSlug, routePath: path } })),
    [appSlug]
  );

  const handleRequestDeEscalation = useCallback(
    ({ sessionId, viewState, routePath: capturedRoute }) => {
      window.dispatchEvent(
        new CustomEvent("sommatic:app:fullscreen-return-to-chat", {
          detail: { appSlug, sessionId, viewState, routePath: capturedRoute },
        })
      );
      goBack();
    },
    [appSlug, goBack]
  );

  return (
    <section className="d-flex flex-column flex-grow-1 h-100">
      <AppRuntimeHostComponent
        appSlug={appSlug}
        routePath={initialRoutePath.current}
        launchMode="fullscreen"
        inputPayload={initialInputPayload.current}
        appSessionService={appSessionService}
        {...runtimeIdentity}
        apiBaseUrl={import.meta.env.VITE_APP_BACKEND_URL || ""}
        onClose={goBack}
        onSubmitOutput={handleSubmitOutput}
        onRouteChange={handleRouteChange}
        onRequestDeEscalation={handleRequestDeEscalation}
      />
    </section>
  );
}

/** An App Engine app in full screen inside the frame. */
export default function AppEngineRuntimeComponent() {
  return (
    <AppEngineSDKProvider>
      <AppEngineRuntimeInner />
    </AppEngineSDKProvider>
  );
}
