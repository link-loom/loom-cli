import { OnPageLoaded, usePageMeta } from "@link-loom/react-sdk";

import { useCopy } from "@i18n/index";
import AccountProfileComponent from "@components/pages/account/profile/AccountProfile.component";

export default function AccountProfilePage() {
  const copy = useCopy();
  usePageMeta({ title: copy.account.profile.title, breadcrumb: [] });

  return (
    <>
      <AccountProfileComponent />
      <OnPageLoaded />
    </>
  );
}
