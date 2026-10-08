import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LocaleProvider, ThemeModeProvider } from "@link-loom/react-shell";

import appConfig from "@app-config";
import { DICTIONARIES } from "@i18n/index";
import { THEME_COLORS, THEME_COLORS_DARK } from "@constants/theme";

/** Prints where the router is, so a test can check a navigation. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/**
 * Renders inside the providers every screen has: router, language and theme. `path` mounts the UI on a route pattern
 * (for `useParams`); the current location is always readable through `screen.getByTestId("location")`.
 */
export const renderWithProviders = (ui, { route = `${appConfig.basePath}/overview`, path, locale = "en" } = {}) => {
  window.localStorage.setItem(`${appConfig.storageKey}:locale`, locale);

  return render(
    <MemoryRouter initialEntries={[route]}>
      <LocaleProvider dictionaries={DICTIONARIES} defaultLocale={locale} storageKey={appConfig.storageKey}>
        <ThemeModeProvider colors={THEME_COLORS} darkColors={THEME_COLORS_DARK} storageKey={appConfig.storageKey}>
          {path ? (
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={null} />
            </Routes>
          ) : (
            ui
          )}
          <LocationProbe />
        </ThemeModeProvider>
      </LocaleProvider>
    </MemoryRouter>
  );
};
