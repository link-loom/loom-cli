import appConfig from "@app-config";
import AppEngineRuntimeComponent from "@components/pages/stoneos/runtime/AppEngineRuntime.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@link-loom/cloud-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["AppRuntimeHostComponent", "AppEngineSDKProvider"]),
  useAppEngineSDK: () => ({ appSessionService: {} }),
}));
jest.mock("@hooks/useAppRuntimeIdentity.hook", () => () => ({ loomCloudBaseUrl: "http://cloud.test" }));

describe("App runtime", () => {
  it("opens the app of the route full screen, at the path after its slug", () => {
    renderWithProviders(<AppEngineRuntimeComponent />, {
      route: `${appConfig.basePath}/app-engine/runtime/stoneos-notes/notes/42`,
      path: `${appConfig.basePath}/app-engine/runtime/:appSlug/*`,
    });

    expect(lastProps.AppRuntimeHostComponent).toMatchObject({
      appSlug: "stoneos-notes",
      routePath: "/notes/42",
      launchMode: "fullscreen",
      loomCloudBaseUrl: "http://cloud.test",
    });
  });
});
