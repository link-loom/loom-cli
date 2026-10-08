import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";
import { VeripassNewPassword } from "@veripass/react-sdk";

import appConfig from "@app-config";
import { useCopy } from "@i18n/index";
import { publicUrl } from "@utils/paths.utils";

export default function AuthNewPasswordPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.auth.newPassword.title });

  return (
    <>
      <section className="col-12 col-md-10 col-lg-6 col-xl-5 mx-auto">
        <VeripassNewPassword organization={{ logoSrc: publicUrl(appConfig.brand.logo), slogan: copy.app.description }} />
      </section>
      <OnPageLoaded />
    </>
  );
}
