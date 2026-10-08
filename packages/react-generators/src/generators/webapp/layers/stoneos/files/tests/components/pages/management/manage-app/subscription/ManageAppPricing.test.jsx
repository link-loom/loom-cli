import { act, screen } from "@testing-library/react";

import appConfig from "@app-config";
import ManageAppPricingComponent from "@components/pages/management/manage-app/subscription/ManageAppPricing.component";
import { lastProps } from "@tests/support/sdk-stubs";
import { renderWithProviders } from "@tests/support/render";

jest.mock("@link-loom/cloud-sdk", () => jest.requireActual("@tests/support/sdk-stubs").stubs(["PricingTableComponent"]));

describe("Pricing", () => {
  it("shows this app's plans and sends a chosen plan to billing", () => {
    renderWithProviders(<ManageAppPricingComponent />);

    expect(lastProps.PricingTableComponent).toMatchObject({ slug: appConfig.slug, locale: "en", baseUrl: "http://cloud.test" });

    act(() => lastProps.PricingTableComponent.onAction({ action: "plan-select" }));
    expect(screen.getByTestId("location")).toHaveTextContent(`${appConfig.basePath}/${appConfig.slug}/subscription/billing`);
  });
});
