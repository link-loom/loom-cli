import { useNavigate } from "react-router-dom";
import { BillingCenterComponent } from "@link-loom/cloud-sdk";

import appConfig from "@app-config";
import { BILLING_THEME } from "@constants/theme";
import { useLocale } from "@i18n/index";
import useBillingService from "@hooks/useBillingService.hook";
import { appPath } from "@utils/paths.utils";

/** The plan, usage and invoices of this app, and the billing details. */
export default function ManageAppBillingComponent() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const billingService = useBillingService();

  const handleAction = ({ action }) => {
    if (action !== "change-plan") {
      return;
    }

    navigate(appPath(`/${appConfig.slug}/subscription/pricing`));
  };

  return (
    <section className="container-fluid my-4 px-4">
      <section className="col-12 col-xl-10 mx-auto d-block">
        <article className="card mb-0">
          <section className="card-body p-4">
            <BillingCenterComponent
              service={billingService}
              product={appConfig.slug}
              locale={locale}
              theme={BILLING_THEME}
              onAction={handleAction}
            />
          </section>
        </article>
      </section>
    </section>
  );
}
