import { PlatformHub } from "@link-loom/cloud-sdk";

import appConfig from "@app-config";
import { useCopy, useLocale } from "@i18n/index";
import { iconFor } from "@constants/iconLibrary";
import usePlatform from "@hooks/usePlatform.hook";
import { copyAt } from "@utils/copy.utils";
import { appPath, publicUrl } from "@utils/paths.utils";
import { PLATFORM_SECTIONS } from "./platform.sections";

/** One platform of the ecosystem: the sections this app has for it, its help center and its own portal. */
export default function PlatformHubComponent() {
  const copy = useCopy();
  const { locale } = useLocale();
  const { platform } = usePlatform();

  if (!platform) {
    return null;
  }

  const sections = (PLATFORM_SECTIONS[platform.id] || []).map((section) => ({
    to: appPath(section.to),
    title: copyAt(copy, section.titleKey),
    description: copyAt(copy, section.descriptionKey),
    Icon: iconFor(section.icon),
  }));

  return (
    <PlatformHub
      platform={platform}
      locale={locale}
      sections={sections}
      supportPath={appPath(`/platforms/${platform.id}/support`)}
      iconBasePath={publicUrl(appConfig.stoneos.platformIconPath)}
    />
  );
}
