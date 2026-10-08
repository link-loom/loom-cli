import { screen } from "@testing-library/react";

import appConfig from "@app-config";
import MaintenanceGeneralComponent from "@components/pages/maintenance/MaintenanceGeneral.component";
import { renderWithProviders } from "@tests/support/render";

describe("Page not found", () => {
  it("says so and leads back to the overview", () => {
    renderWithProviders(<MaintenanceGeneralComponent />);

    expect(screen.getByRole("heading", { name: "This page is not here" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the overview" })).toHaveAttribute("href", `${appConfig.basePath}/overview`);
  });
});
