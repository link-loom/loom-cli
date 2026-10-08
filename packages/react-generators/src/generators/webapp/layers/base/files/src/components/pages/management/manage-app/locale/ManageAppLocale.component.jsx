import { LocaleThemeSettings } from "@link-loom/react-shell";

import { useCopy } from "@i18n/index";

/** Language and theme. Both apply at once and are remembered in this browser. */
export default function ManageAppLocaleComponent() {
  const copy = useCopy();
  const words = copy.manageApp.locale;

  return (
    <section className="container-fluid my-4 px-4">
      <section className="col-12 col-xl-9 mx-auto d-block">
        <article className="card shadow mb-3">
          <section className="card-body">
            <h5 className="fw-bold mb-1">{words.title}</h5>
            <p className="text-muted small mb-4">{words.subtitle}</p>
            <LocaleThemeSettings labels={words.settings} />
          </section>
        </article>
      </section>
    </section>
  );
}
