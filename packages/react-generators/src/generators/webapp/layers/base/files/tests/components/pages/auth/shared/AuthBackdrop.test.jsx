import { render, screen } from "@testing-library/react";

import AuthBackdrop from "@components/pages/auth/shared/AuthBackdrop.component";

describe("AuthBackdrop", () => {
  it("puts the form on the sign-in ground", () => {
    render(
      <AuthBackdrop>
        <p>Form</p>
      </AuthBackdrop>
    );

    expect(screen.getByText("Form").parentElement).toHaveClass("app-auth-backdrop");
  });
});
