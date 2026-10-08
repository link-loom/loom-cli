import { screen } from "@testing-library/react";
import { KeyOutlined } from "@mui/icons-material";

import HubCards from "@components/shared/hub-cards/HubCards.component";
import { renderWithProviders } from "@tests/support/render";

describe("HubCards", () => {
  it("shows the title, the line under it and a link card per entry", () => {
    renderWithProviders(
      <HubCards
        title="Advanced settings"
        subtitle="Everything about the account"
        cards={[{ id: "keys", href: "/client/security/api-keys", title: "Security", description: "API keys", Icon: KeyOutlined, color: "#3c4876" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Advanced settings" })).toBeInTheDocument();
    expect(screen.getByText("Everything about the account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Security/ })).toHaveAttribute("href", "/client/security/api-keys");
  });
});
