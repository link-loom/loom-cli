import { renderHook } from "@testing-library/react";
import { useAuth } from "@veripass/react-sdk";

import useCurrentUser from "@hooks/useCurrentUser.hook";

jest.mock("@veripass/react-sdk", () => ({ useAuth: jest.fn() }));

describe("useCurrentUser", () => {
  it("reads the person and the active organization from the Veripass session", () => {
    useAuth.mockReturnValue({
      user: {
        identity: "user-1",
        memberships: { active: { organization_id: "org-1" } },
        payload: { app_id: "app-1", profile: { display_name: "Ada Lovelace", first_name: "Ada", primary_email_address: "ada@example.com" } },
      },
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current).toMatchObject({
      identity: "user-1",
      name: "Ada Lovelace",
      firstName: "Ada",
      email: "ada@example.com",
      organizationId: "org-1",
      appId: "app-1",
    });
  });

  it("is empty without a session", () => {
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current).toMatchObject({ identity: "", name: "", email: "", organizationId: "" });
  });
});
