import { act, screen } from "@testing-library/react";

import appConfig from "@app-config";
import ManageAppBillingComponent from "@components/pages/management/manage-app/subscription/ManageAppBilling.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@link-loom/cloud-sdk", () => jest.requireActual("@tests/support/sdk-stubs").stubs(["BillingCenterComponent"]));
jest.mock("@hooks/useBillingService.hook", () => () => ({ name: "billing-service" }));

describe("Billing", () => {
  it("bills this app as its own product and opens pricing to change the plan", () => {
    renderWithProviders(<ManageAppBillingComponent />);

    expect(lastProps.BillingCenterComponent).toMatchObject({ product: appConfig.slug, service: { name: "billing-service" } });

    act(() => lastProps.BillingCenterComponent.onAction({ action: "change-plan" }));
    expect(screen.getByTestId("location")).toHaveTextContent(`${appConfig.basePath}/${appConfig.slug}/subscription/pricing`);
  });
});
