import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "@link-loom/react-shell";

import appConfig from "@app-config";
import { DICTIONARIES } from "@i18n/index";
import usePlatform from "@hooks/usePlatform.hook";

const at = (route) =>
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <LocaleProvider dictionaries={DICTIONARIES} defaultLocale="en" storageKey={appConfig.storageKey}>
          <Routes>
            <Route path="/client/platforms/:platformId" element={children} />
          </Routes>
        </LocaleProvider>
      </MemoryRouter>
    );
  };

describe("usePlatform", () => {
  it("finds the platform of the route with its copy", () => {
    const { result } = renderHook(() => usePlatform(), { wrapper: at("/client/platforms/veripass") });

    expect(result.current.platform.id).toBe("veripass");
    expect(result.current.labels.capability).toBe("Identity");
  });

  it("knows nothing of a platform the app does not show", () => {
    const { result } = renderHook(() => usePlatform(), { wrapper: at("/client/platforms/etrune") });

    expect(result.current).toEqual({ platform: null, labels: null });
  });
});
