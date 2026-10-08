import { renderHook } from "@testing-library/react";
import { MonetizationBillingService } from "@link-loom/cloud-sdk";
import { useAuth } from "@veripass/react-sdk";

import useBillingService from "@hooks/useBillingService.hook";

jest.mock("@veripass/react-sdk", () => ({ useAuth: jest.fn() }));
jest.mock("@link-loom/cloud-sdk", () => {
  const MonetizationBillingService = jest.fn(function MonetizationBillingService(options) {
    this.options = options;
  });
  MonetizationBillingService.identityHeaders = jest.fn(() => ({ authorization: "Bearer token-1" }));
  return { MonetizationBillingService };
});

describe("useBillingService", () => {
  it("talks to Link Loom Cloud for the signed-in person's organization", () => {
    useAuth.mockReturnValue({ user: { payload: { organization_id: "org-1" } }, getToken: () => "token-1" });

    const { result } = renderHook(() => useBillingService());
    result.current.options.getHeaders();

    expect(result.current.options.baseUrl).toBe("http://cloud.test");
    expect(MonetizationBillingService.identityHeaders).toHaveBeenCalledWith("token-1", "org-1");
  });
});
