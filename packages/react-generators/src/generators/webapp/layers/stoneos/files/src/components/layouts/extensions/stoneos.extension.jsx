import { useMemo } from "react";
import { appStoreLabels, launchpadLabels, LaunchpadProvider, stoneOSAppsMenuItems } from "@link-loom/cloud-sdk";

import appConfig from "@app-config";
import { useLocale } from "@i18n/index";
import { publicUrl } from "@utils/paths.utils";

/**
 * StoneOS around the frame: the launchpad (the apps rail of the sidebar, My apps and the App Store) reads its copy,
 * the ecosystem's platforms and this app's base route from here.
 */
export default function StoneOSExtension({ children }) {
  const { locale } = useLocale();
  const platforms = useMemo(
    () => stoneOSAppsMenuItems({ locale, iconBasePath: publicUrl(appConfig.stoneos.platformIconPath) }).apps,
    [locale]
  );

  return (
    <LaunchpadProvider
      labels={launchpadLabels(locale)}
      storeLabels={appStoreLabels(locale)}
      platforms={platforms}
      basePath={appConfig.basePath}
      baseUrl={import.meta.env.VITE_LOOM_CLOUD_BACKEND_URL}
      storageNamespace={appConfig.storageKey}
    >
      {children}
    </LaunchpadProvider>
  );
}
