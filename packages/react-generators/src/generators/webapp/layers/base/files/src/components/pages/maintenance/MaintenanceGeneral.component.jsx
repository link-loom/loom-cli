import { Link } from "react-router-dom";

import { useCopy } from "@i18n/index";
import { appPath } from "@utils/paths.utils";

/** What a person sees on a page that does not exist or is not ready yet. */
export default function MaintenanceGeneralComponent() {
  const copy = useCopy();

  return (
    <section className="row justify-content-center">
      <article className="col-12 col-md-8 col-lg-6 text-center py-5">
        <h1 className="h3 mb-2">{copy.maintenance.title}</h1>
        <p className="text-muted mb-4">{copy.maintenance.description}</p>
        <Link className="btn btn-primary" to={appPath("/overview")}>
          {copy.maintenance.action}
        </Link>
      </article>
    </section>
  );
}
