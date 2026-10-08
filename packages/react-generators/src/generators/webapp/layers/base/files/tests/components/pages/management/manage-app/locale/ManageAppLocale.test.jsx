import { fireEvent, screen } from "@testing-library/react";

import appConfig from "@app-config";
import ManageAppLocaleComponent from "@components/pages/management/manage-app/locale/ManageAppLocale.component";
import { renderWithProviders } from "@tests/support/render";

describe("Language and theme", () => {
  it("switches the language at once and remembers it", () => {
    renderWithProviders(<ManageAppLocaleComponent />);

    fireEvent.click(screen.getByLabelText("Español"));

    expect(screen.getByRole("heading", { name: "Idioma y tema" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
    expect(window.localStorage.getItem(`${appConfig.storageKey}:locale`)).toBe("es");
  });

  it("switches the theme and marks it for Bootstrap", () => {
    renderWithProviders(<ManageAppLocaleComponent />);

    fireEvent.click(screen.getByLabelText("Dark"));

    expect(document.documentElement.dataset.bsTheme).toBe("dark");
  });
});
