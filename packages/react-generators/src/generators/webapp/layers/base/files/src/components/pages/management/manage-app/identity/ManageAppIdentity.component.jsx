import { useCallback, useEffect, useState } from "react";
import {
  CORPORATE_IDENTITY_ACTIONS as ACTIONS,
  CORPORATE_IDENTITY_NAMESPACE as NAMESPACE,
  fetchEntityCollection,
  OrganizationManagementService,
  updateEntityRecord,
  VeripassOrganizationBranding,
  VeripassOrganizationIdentityHero,
  VeripassOrganizationOfficialIdentity,
  VeripassOrganizationPublicPresence,
  VeripassOrganizationPublicProfilePreview,
  VeripassOrganizationSecurityAudit,
  VeripassOrganizationVerificationStatus,
} from "@veripass/react-sdk";

import { useCopy, useLocale } from "@i18n/index";
import useCurrentUser from "@hooks/useCurrentUser.hook";

const ADMIN_ROLES = new Set(["admin", "owner", "administrator"]);
const ENVIRONMENT = import.meta.env.VITE_APP_BLACKWOOD_APPS_ENVIRONMENT;
const API_KEY = import.meta.env.VITE_APP_VERIPASS_API_KEY;
const VERIPASS = { environment: ENVIRONMENT, apiKey: API_KEY };

const sectionPayload = (organization, sectionKey, data) => {
  if (sectionKey === "hero") {
    return { id: organization.id, profile: { ...organization.profile, ...data } };
  }

  if (sectionKey === "official-identity") {
    const { website_url: websiteUrl, description, ...profile } = data;
    return {
      id: organization.id,
      profile: { ...organization.profile, ...profile },
      information: { ...organization.information, website_url: websiteUrl || "", description: description || "" },
    };
  }

  if (sectionKey === "branding") {
    return {
      id: organization.id,
      profile: {
        ...organization.profile,
        profile_ui_settings: {
          ...organization.profile?.profile_ui_settings,
          profile_picture_url: data.logo_url || "",
          cover_picture_url: data.cover_picture_url || "",
          brand_colors: data.brand_colors || {},
        },
      },
    };
  }

  return { id: organization.id };
};

function CenteredNotice({ text }) {
  return (
    <section className="container-fluid my-4 px-4">
      <section className="d-flex justify-content-center align-items-center py-5">
        <span className="text-muted">{text}</span>
      </section>
    </section>
  );
}

/** The organization's corporate identity in Veripass: who it is, how it presents itself and how verified it is. */
export default function ManageAppIdentityComponent() {
  const copy = useCopy();
  const { locale } = useLocale();
  const { organizationId, roles } = useCurrentUser();
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null);
  const mode = roles.some((role) => ADMIN_ROLES.has(role?.slug)) ? "admin" : "viewer";
  const words = copy.manageApp.identity;

  const fetchOrganization = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const response = await fetchEntityCollection({
      service: OrganizationManagementService,
      payload: { queryselector: "id", query: { search: organizationId } },
      apiKey: API_KEY,
      settings: { environment: ENVIRONMENT },
    });
    setIsLoading(false);

    if (!response?.success) {
      return;
    }

    const items = response.result?.items;
    setOrganization(Array.isArray(items) ? items[0] || null : response.result || null);
  }, [organizationId]);

  const saveSection = async (sectionKey, data) => {
    const response = await updateEntityRecord({
      service: OrganizationManagementService,
      payload: sectionPayload(organization, sectionKey, data),
      apiKey: API_KEY,
      settings: { environment: ENVIRONMENT },
    });

    if (!response?.success) {
      return;
    }

    setEditingSection(null);
    await fetchOrganization();
  };

  const handleItemOnAction = ({ action, namespace, payload }) => {
    if (namespace !== NAMESPACE) {
      return;
    }

    if (action === ACTIONS.SECTION_EDIT_START) {
      setEditingSection(payload?.sectionKey);
      return;
    }

    if (action === ACTIONS.SECTION_EDIT_CANCEL) {
      setEditingSection(null);
      return;
    }

    if (action === ACTIONS.SECTION_SAVE) {
      saveSection(payload?.sectionKey, payload?.data);
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  if (isLoading) {
    return <CenteredNotice text={words.loading} />;
  }

  if (!organization) {
    return <CenteredNotice text={words.notFound} />;
  }

  const shared = { organization, mode, editingSection, itemOnAction: handleItemOnAction, updateOnAction: () => {} };
  const modifiedAt = Number(organization.modified?.timestamp || organization.modified?.at);

  return (
    <section className="container-fluid my-4 px-4">
      <section className="col-12 col-xl-11 mx-auto d-block">
        <article className="card shadow mb-3 overflow-hidden">
          <section className="card-body p-0">
            <VeripassOrganizationIdentityHero {...shared} ui={{ showShell: false, showLogo: false }} />
          </section>
        </article>

        <section className="row g-3 mb-3">
          <article className="col-12 col-md-7">
            <section className="card shadow h-100">
              <section className="card-body">
                <VeripassOrganizationOfficialIdentity {...shared} {...VERIPASS} ui={{ showShell: false, showLogo: false, inputSize: "small" }} />
              </section>
            </section>
          </article>
          <article className="col-12 col-md-5">
            <section className="card shadow h-100">
              <section className="card-body">
                <VeripassOrganizationPublicPresence {...shared} ui={{ showShell: false, showLogo: false }} />
              </section>
            </section>
          </article>
        </section>

        <article className="card shadow mb-3">
          <section className="card-body">
            <VeripassOrganizationBranding {...shared} {...VERIPASS} ui={{ showShell: false, showLogo: false, inputSize: "small" }} />
          </section>
        </article>

        <section className="row g-3 mb-3">
          <article className="col-12 col-md-4">
            <section className="card shadow h-100 overflow-hidden">
              <section className="card-body p-0 h-100">
                <VeripassOrganizationPublicProfilePreview organization={organization} ui={{ showShell: false, showLogo: false }} />
              </section>
            </section>
          </article>
          <article className="col-12 col-md-4">
            <section className="card shadow h-100 overflow-hidden">
              <section className="card-body p-0 h-100">
                <VeripassOrganizationVerificationStatus {...shared} ui={{ showShell: false, showLogo: false }} />
              </section>
            </section>
          </article>
          <article className="col-12 col-md-4">
            <section className="card shadow h-100 overflow-hidden">
              <section className="card-body p-0 h-100">
                <VeripassOrganizationSecurityAudit organization={organization} ui={{ showShell: false }} />
              </section>
            </section>
          </article>
        </section>

        {modifiedAt ? (
          <footer className="text-muted small px-1 mb-4">
            {words.lastUpdated}{" "}
            <strong>{new Date(modifiedAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</strong>
          </footer>
        ) : null}
      </section>
    </section>
  );
}
