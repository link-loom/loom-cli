import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PricingTableComponent } from "@link-loom/cloud-sdk";

import appConfig from "@app-config";
import { BILLING_THEME } from "@constants/theme";
import { useLocale } from "@i18n/index";
import { appPath } from "@utils/paths.utils";

const SELECT_ACTIONS = new Set(["plan-select", "contact-sales"]);

/** The plans of this app, served by the Link Loom Cloud pricing catalog under the app's slug. */
export default function ManageAppPricingComponent() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [cycle, setCycle] = useState(undefined);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const handleAction = ({ action }) => {
    if (!SELECT_ACTIONS.has(action)) {
      return;
    }

    navigate(appPath(`/${appConfig.slug}/subscription/billing`));
  };

  return (
    <section className="container-fluid my-4 px-4">
      <section className="col-12 col-xl-10 mx-auto d-block">
        <PricingTableComponent
          baseUrl={import.meta.env.VITE_LOOM_CLOUD_BACKEND_URL}
          slug={appConfig.slug}
          locale={locale}
          theme={BILLING_THEME}
          cycle={cycle}
          onCycleChange={setCycle}
          openFaqIndex={openFaqIndex}
          onFaqToggle={setOpenFaqIndex}
          onAction={handleAction}
        />
      </section>
    </section>
  );
}
