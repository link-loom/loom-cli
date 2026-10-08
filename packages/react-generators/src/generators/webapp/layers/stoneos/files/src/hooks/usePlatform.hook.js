import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { platformLabels, platformsForSettings } from "@link-loom/cloud-sdk";

import appConfig from "@app-config";
import { useLocale } from "@i18n/index";

/** The platform of the current `:platformId` route, if this app shows it, with its copy in the active language. */
export default function usePlatform() {
  const { platformId } = useParams();
  const { locale } = useLocale();

  return useMemo(() => {
    const platform = platformsForSettings().find(
      (entry) => entry.id === platformId && appConfig.stoneos.platforms.includes(entry.id)
    );

    return { platform: platform || null, labels: platform ? platformLabels(platform, locale) : null };
  }, [platformId, locale]);
}
