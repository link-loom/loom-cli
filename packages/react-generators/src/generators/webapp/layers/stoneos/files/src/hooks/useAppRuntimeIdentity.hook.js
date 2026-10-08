import { useCallback, useMemo } from "react";
import { useAuth } from "@veripass/react-sdk";

import appConfig from "@app-config";
import { useLocale } from "@i18n/index";
import useCurrentUser from "@hooks/useCurrentUser.hook";

const LOOM_CLOUD_BACKEND_URL = import.meta.env.VITE_LOOM_CLOUD_BACKEND_URL || "";

/**
 * What every App Engine app receives from this host: the Veripass session (read on demand, so a refreshed token
 * reaches the app), the Link Loom Cloud backend behind `sdk.data`, `sdk.files` and signals, the organization and the
 * host context. Spread the result onto `AppRuntimeHostComponent`.
 */
export default function useAppRuntimeIdentity() {
  const { getToken } = useAuth();
  const { organizationId } = useCurrentUser();
  const { locale } = useLocale();
  const getIdentitySession = useCallback(() => getToken?.() || null, [getToken]);

  return useMemo(
    () => ({
      getIdentitySession,
      loomCloudBaseUrl: LOOM_CLOUD_BACKEND_URL,
      eventsBaseUrl: LOOM_CLOUD_BACKEND_URL,
      eventOrganizationId: organizationId || undefined,
      hostContext: { platform: appConfig.slug, name: appConfig.name, capabilities: [], locale },
    }),
    [getIdentitySession, organizationId, locale]
  );
}
