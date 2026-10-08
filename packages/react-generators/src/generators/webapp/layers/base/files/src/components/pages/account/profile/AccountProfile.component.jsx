import { VeripassUserManager } from "@veripass/react-sdk";

import { useCopy } from "@i18n/index";
import useCurrentUser from "@hooks/useCurrentUser.hook";
import { publicUrl } from "@utils/paths.utils";

/** The person's own Veripass record, and the way to sign out everywhere. */
export default function AccountProfileComponent() {
  const copy = useCopy();
  const { identity } = useCurrentUser();

  return (
    <section className="container-fluid my-4 px-4">
      <section className="row mb-4">
        <article className="col-12 mx-auto">
          <VeripassUserManager
            userId={identity}
            apiKey={import.meta.env.VITE_APP_VERIPASS_API_KEY}
            environment={import.meta.env.VITE_APP_BLACKWOOD_APPS_ENVIRONMENT}
          />
        </article>
      </section>
      <section className="row">
        <article className="col-12 col-xl-10 mx-auto">
          <section className="card">
            <section className="card-body">
              <h4 className="mt-0 mb-3">{copy.account.signOutEverywhere.title}</h4>
              <p>{copy.account.signOutEverywhere.description}</p>
              <a href={publicUrl("/auth/logout")} className="btn btn-outline-danger">
                {copy.account.signOutEverywhere.action}
              </a>
            </section>
          </section>
        </article>
      </section>
    </section>
  );
}
