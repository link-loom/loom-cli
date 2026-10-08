import { act, screen } from "@testing-library/react";

import TenancySetupComponent from "@components/pages/setup/tenancy-setup/TenancySetup.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@veripass/react-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["VeripassTenancyOnboardingManager"]),
  useAuth: () => ({ user: { identity: "user-1" } }),
}));

describe("Organization setup", () => {
  it("sends the person to sign in once the organization is ready", () => {
    renderWithProviders(<TenancySetupComponent />, { route: "/setup/workspace" });

    act(() => lastProps.VeripassTenancyOnboardingManager.onEvent({ action: "veripass-tenancy-onboarding::all-set/continue" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/auth/login");
  });
});
