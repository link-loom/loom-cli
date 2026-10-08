import { screen } from "@testing-library/react";

import appConfig from "@app-config";
import ManageAppHomeComponent from "@components/pages/management/manage-app/home/ManageAppHome.component";
import { renderWithProviders } from "@tests/support/render";

describe("Manage the app", () => {
  it("opens language and theme from its own route", () => {
    renderWithProviders(<ManageAppHomeComponent />);

    expect(screen.getByRole("heading", { name: `Manage ${appConfig.name}` })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Language and theme/ })).toHaveAttribute(
      "href",
      `${appConfig.basePath}/${appConfig.slug}/locale`
    );
  });
});
