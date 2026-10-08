import { screen } from "@testing-library/react";
import { useAuth } from "@veripass/react-sdk";

import AccountProfileComponent from "@components/pages/account/profile/AccountProfile.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@veripass/react-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["VeripassUserManager"]),
  useAuth: jest.fn(),
}));

describe("My profile", () => {
  it("shows the person's own Veripass record and the way to sign out everywhere", () => {
    useAuth.mockReturnValue({ user: { identity: "user-1" } });
    renderWithProviders(<AccountProfileComponent />);

    expect(lastProps.VeripassUserManager.userId).toBe("user-1");
    expect(screen.getByRole("link", { name: "Sign out everywhere" })).toHaveAttribute("href", "/auth/logout");
  });
});
