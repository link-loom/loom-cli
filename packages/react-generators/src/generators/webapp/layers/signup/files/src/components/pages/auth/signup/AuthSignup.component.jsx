import { useNavigate } from "react-router-dom";
import { VeripassStandardSignup } from "@veripass/react-sdk";

import appConfig from "@app-config";
import { THEME_COLORS } from "@constants/theme";
import { useCopy } from "@i18n/index";
import { publicUrl } from "@utils/paths.utils";
import AuthBackdrop from "@components/pages/auth/shared/AuthBackdrop.component";

/** Veripass sign-up; the new account continues to the organization setup. */
export default function AuthSignupComponent() {
  const copy = useCopy();
  const navigate = useNavigate();
  const logoSrc = publicUrl(appConfig.brand.logo);

  return (
    <AuthBackdrop>
      <section className="col-12 mx-auto">
        <VeripassStandardSignup
          ui={{
            logo: { src: logoSrc, height: "60" },
            title: copy.auth.signup.welcome,
            showTitle: true,
            heroImage: {
              src: publicUrl(appConfig.brand.authHero),
              alt: appConfig.name,
              title: copy.auth.signup.heroTitle,
              subtitle: copy.auth.signup.heroSubtitle,
              borderRadius: "1rem",
            },
            theme: { brandPrimary: THEME_COLORS.brandPrimary, brandPrimaryForeground: THEME_COLORS.onBrand, linkColor: THEME_COLORS.brandPrimary },
          }}
          organization={{ name: appConfig.name, src: logoSrc, slogan: copy.app.description }}
          redirectUrl={publicUrl("/setup/workspace")}
          loginUrl={publicUrl("/auth/login")}
          onLoginClick={(event) => {
            event.preventDefault();
            navigate("/auth/login");
          }}
          environment={import.meta.env.VITE_APP_BLACKWOOD_APPS_ENVIRONMENT}
          apiKey={import.meta.env.VITE_APP_VERIPASS_API_KEY}
        />
      </section>
    </AuthBackdrop>
  );
}
