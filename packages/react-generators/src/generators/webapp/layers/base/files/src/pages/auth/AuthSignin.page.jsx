import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import AuthSigninComponent from "@components/pages/auth/signin/AuthSignin.component";

export default function AuthSigninPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.auth.signin.title, breadcrumb: [] });

  return (
    <>
      <AuthSigninComponent />
      <OnPageLoaded />
    </>
  );
}
