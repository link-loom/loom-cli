import { useNavigate } from "react-router-dom";
import { useAuth, VeripassTenancyOnboardingManager } from "@veripass/react-sdk";

import appConfig from "@app-config";
import { THEME_COLORS } from "@constants/theme";
import { useCopy } from "@i18n/index";
import { publicUrl } from "@utils/paths.utils";
import AuthBackdrop from "@components/pages/auth/shared/AuthBackdrop.component";

const FINISHED = new Set(["veripass-tenancy-onboarding::all-set/continue", "veripass-tenancy-onboarding::all-set/go-dashboard"]);
const LAYOUT = {
  width: { xl: "580px", lg: "580px", md: "540px", sm: "500px" },
  minWidth: { xl: "580px", lg: "580px", md: "420px", sm: "400px", xs: "100%" },
};

/** Create, join or choose the organization the new account works in; then sign in to it. */
export default function TenancySetupComponent() {
  const copy = useCopy();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleOnboardingEvent = (event) => {
    if (!FINISHED.has(event?.action)) {
      return;
    }

    navigate("/auth/login");
  };

  return (
    <AuthBackdrop>
      <section className="col-12 mx-auto">
        <VeripassTenancyOnboardingManager
          ui={{
            title: copy.setup.title,
            showTitle: true,
            defaultCreateApp: true,
            theme: { brandPrimary: THEME_COLORS.brandPrimary, brandPrimaryForeground: THEME_COLORS.onBrand, linkColor: THEME_COLORS.brandPrimary },
            copy: copy.setup.steps,
            layout: LAYOUT,
          }}
          organization={{ name: appConfig.name, logoSrc: publicUrl(appConfig.brand.logo), slogan: copy.app.description }}
          user={user}
          onEvent={handleOnboardingEvent}
          environment={import.meta.env.VITE_APP_BLACKWOOD_APPS_ENVIRONMENT}
          apiKey={import.meta.env.VITE_APP_VERIPASS_API_KEY}
        />
      </section>
    </AuthBackdrop>
  );
}
