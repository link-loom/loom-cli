import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import AuthCallbackComponent from "@components/pages/auth/callback/AuthCallback.component";

export default function AuthCallbackPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.auth.callback.title, breadcrumb: [] });

  return (
    <>
      <AuthCallbackComponent />
      <OnPageLoaded />
    </>
  );
}
