import appConfig from "@app-config";
import PlatformHubComponent from "@components/pages/platforms/hub/PlatformHub.component";
import { PLATFORM_SECTIONS } from "@components/pages/platforms/hub/platform.sections";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@link-loom/cloud-sdk", () => ({
  ...jest.requireActual("@link-loom/cloud-sdk"),
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["PlatformHub"]),
}));

describe("Platform page", () => {
  it("shows the platform's hub with its help center under this app", () => {
    renderWithProviders(<PlatformHubComponent />, {
      route: `${appConfig.basePath}/platforms/veripass`,
      path: `${appConfig.basePath}/platforms/:platformId`,
    });

    expect(lastProps.PlatformHub.platform.id).toBe("veripass");
    expect(lastProps.PlatformHub.supportPath).toBe(`${appConfig.basePath}/platforms/veripass/support`);
    // The sections this app built for Identity (`npx link-loom add platform-section`), as cards with an absolute link.
    expect(lastProps.PlatformHub.sections.map((section) => section.to)).toEqual(
      (PLATFORM_SECTIONS.veripass || []).map((section) => `${appConfig.basePath}${section.to}`)
    );
  });
});
