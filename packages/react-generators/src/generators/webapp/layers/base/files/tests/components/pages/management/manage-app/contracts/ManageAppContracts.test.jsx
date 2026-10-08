import { screen } from "@testing-library/react";
import { fetchEntityCollection, useAuth } from "@veripass/react-sdk";

import ManageAppContractsComponent from "@components/pages/management/manage-app/contracts/ManageAppContracts.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@veripass/react-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["VeripassContractAcceptance", "VeripassOrganizationContractsList"]),
  ContractManagementService: class ContractManagementService {},
  IdentityContractService: class IdentityContractService {},
  createEntityRecord: jest.fn(),
  fetchEntityCollection: jest.fn(),
  useAuth: jest.fn(),
}));

describe("Contracts and terms", () => {
  it("asks to accept what is still pending and lists every agreement", async () => {
    useAuth.mockReturnValue({ user: { identity: "user-1", payload: { app_id: "app-1", organization_id: "org-1" } } });
    fetchEntityCollection.mockImplementation(async ({ service }) =>
      service.name === "ContractManagementService"
        ? { success: true, result: { items: [{ id: "terms" }, { id: "privacy" }] } }
        : { success: true, result: { items: [{ contract_id: "terms", status: { name: "signed" } }] } }
    );
    renderWithProviders(<ManageAppContractsComponent />);

    expect(await screen.findByTestId("VeripassContractAcceptance")).toBeInTheDocument();
    expect(lastProps.VeripassContractAcceptance.pendingContracts).toEqual([{ id: "privacy" }]);
    expect(lastProps.VeripassOrganizationContractsList.acceptedContractIds).toEqual(["terms"]);
  });
});
