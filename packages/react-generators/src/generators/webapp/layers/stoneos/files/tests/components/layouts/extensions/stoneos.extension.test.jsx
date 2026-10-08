import appConfig from "@app-config";
import StoneOSExtension from "@components/layouts/extensions/stoneos.extension";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@link-loom/cloud-sdk", () => ({
  ...jest.requireActual("@link-loom/cloud-sdk"),
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["LaunchpadProvider"]),
}));

describe("StoneOS extension", () => {
  it("configures the launchpad with this app's route, storage and language", () => {
    renderWithProviders(<StoneOSExtension />, { locale: "es" });

    expect(lastProps.LaunchpadProvider).toMatchObject({ basePath: appConfig.basePath, storageNamespace: appConfig.storageKey });
    expect(lastProps.LaunchpadProvider.labels.myApps).toBe("Mis apps");
    expect(lastProps.LaunchpadProvider.platforms.map((platform) => platform.id)).toContain("veripass");
  });
});
