import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import AuthSignupComponent from "@components/pages/auth/signup/AuthSignup.component";

export default function AuthSignupPage() {
  const copy = useCopy();
  usePageMeta({ title: copy.auth.signup.title });

  return (
    <>
      <AuthSignupComponent />
      <OnPageLoaded />
    </>
  );
}
