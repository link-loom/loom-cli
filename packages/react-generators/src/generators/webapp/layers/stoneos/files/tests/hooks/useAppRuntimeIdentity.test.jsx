import { renderHook } from "@testing-library/react";
import { useAuth } from "@veripass/react-sdk";
import { LocaleProvider } from "@link-loom/react-shell";

import appConfig from "@app-config";
import { DICTIONARIES } from "@i18n/index";
import useAppRuntimeIdentity from "@hooks/useAppRuntimeIdentity.hook";

jest.mock("@veripass/react-sdk", () => ({ useAuth: jest.fn() }));

describe("useAppRuntimeIdentity", () => {
  it("tells App Engine apps who is signed in, for which organization, from which host", () => {
    useAuth.mockReturnValue({ user: { payload: { organization_id: "org-1" } }, getToken: () => "token-1" });
    const wrapper = ({ children }) => (
      <LocaleProvider dictionaries={DICTIONARIES} defaultLocale="en" storageKey={appConfig.storageKey}>
        {children}
      </LocaleProvider>
    );

    const { result } = renderHook(() => useAppRuntimeIdentity(), { wrapper });

    expect(result.current.getIdentitySession()).toBe("token-1");
    expect(result.current).toMatchObject({
      loomCloudBaseUrl: "http://cloud.test",
      eventOrganizationId: "org-1",
      hostContext: { platform: appConfig.slug, name: appConfig.name, locale: "en" },
    });
  });
});
