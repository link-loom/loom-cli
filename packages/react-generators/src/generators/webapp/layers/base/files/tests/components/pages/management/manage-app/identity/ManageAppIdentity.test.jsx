import { screen } from "@testing-library/react";
import { fetchEntityCollection, useAuth } from "@veripass/react-sdk";

import ManageAppIdentityComponent from "@components/pages/management/manage-app/identity/ManageAppIdentity.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@veripass/react-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs([
    "VeripassOrganizationIdentityHero",
    "VeripassOrganizationOfficialIdentity",
    "VeripassOrganizationPublicPresence",
    "VeripassOrganizationBranding",
    "VeripassOrganizationPublicProfilePreview",
    "VeripassOrganizationVerificationStatus",
    "VeripassOrganizationSecurityAudit",
  ]),
  CORPORATE_IDENTITY_ACTIONS: { SECTION_EDIT_START: "start", SECTION_EDIT_CANCEL: "cancel", SECTION_SAVE: "save" },
  CORPORATE_IDENTITY_NAMESPACE: "corporate-identity",
  OrganizationManagementService: class {},
  fetchEntityCollection: jest.fn(),
  updateEntityRecord: jest.fn(),
  useAuth: jest.fn(),
}));

describe("Corporate identity", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { payload: { organization_id: "org-1", roles: [{ slug: "admin" }] } } });
  });

  it("loads the organization and lets an administrator edit it", async () => {
    fetchEntityCollection.mockResolvedValue({ success: true, result: { items: [{ id: "org-1", profile: {} }] } });
    renderWithProviders(<ManageAppIdentityComponent />);

    expect(await screen.findByTestId("VeripassOrganizationIdentityHero")).toBeInTheDocument();
    expect(lastProps.VeripassOrganizationIdentityHero.mode).toBe("admin");
    expect(fetchEntityCollection.mock.calls[0][0].payload).toEqual({ queryselector: "id", query: { search: "org-1" } });
  });

  it("says so when the organization is not found", async () => {
    fetchEntityCollection.mockResolvedValue({ success: true, result: { items: [] } });
    renderWithProviders(<ManageAppIdentityComponent />);

    expect(await screen.findByText("We could not find your organization.")).toBeInTheDocument();
  });
});
