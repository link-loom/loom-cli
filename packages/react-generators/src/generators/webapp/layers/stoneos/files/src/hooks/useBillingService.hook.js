import { useMemo } from "react";
import { useAuth } from "@veripass/react-sdk";
import { MonetizationBillingService } from "@link-loom/cloud-sdk";

import useCurrentUser from "@hooks/useCurrentUser.hook";

/**
 * The billing service of Link Loom Cloud for the signed-in person, acting for their organization. A different
 * organization gets a new service, so its billing reloads.
 */
export default function useBillingService() {
  const { getToken } = useAuth();
  const { organizationId } = useCurrentUser();

  return useMemo(
    () =>
      new MonetizationBillingService({
        baseUrl: import.meta.env.VITE_LOOM_CLOUD_BACKEND_URL,
        getHeaders: () => MonetizationBillingService.identityHeaders(getToken(), organizationId),
      }),
    [getToken, organizationId]
  );
}
