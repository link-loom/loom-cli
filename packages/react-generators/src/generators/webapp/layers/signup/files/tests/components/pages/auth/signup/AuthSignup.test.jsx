import AuthSignupComponent from "@components/pages/auth/signup/AuthSignup.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@veripass/react-sdk", () => jest.requireActual("@tests/support/sdk-stubs").stubs(["VeripassStandardSignup"]));

describe("Sign-up", () => {
  it("creates the account with Veripass and continues to the organization setup", () => {
    renderWithProviders(<AuthSignupComponent />, { route: "/auth/signup" });

    expect(lastProps.VeripassStandardSignup).toMatchObject({ redirectUrl: "/setup/workspace", loginUrl: "/auth/login" });
  });
});
