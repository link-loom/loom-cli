import { screen } from "@testing-library/react";

import appConfig from "@app-config";
import ManageAppSubscriptionComponent from "@components/pages/management/manage-app/subscription/ManageAppSubscription.component";
import { renderWithProviders } from "@tests/support/render";

describe("Plan and billing", () => {
  it("leads to changing the plan and to billing", () => {
    renderWithProviders(<ManageAppSubscriptionComponent />);

    const root = `${appConfig.basePath}/${appConfig.slug}/subscription`;
    expect(screen.getByRole("link", { name: /Change plan/ })).toHaveAttribute("href", `${root}/pricing`);
    expect(screen.getByRole("link", { name: /Billing and payments/ })).toHaveAttribute("href", `${root}/billing`);
  });
});
