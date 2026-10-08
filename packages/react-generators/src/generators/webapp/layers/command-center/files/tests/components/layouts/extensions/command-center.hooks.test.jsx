import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@link-loom/react-shell";

import appConfig from "@app-config";
import { DICTIONARIES } from "@i18n/index";
import { useCommandCenterSearch, useSupportAssistant } from "@components/layouts/extensions/command-center.hooks";

jest.mock("@sommatic/react-sdk", () => ({
  ConversationExecutionService: class ConversationExecutionService {},
  CognitiveInfrastructureLLMProviderService: class CognitiveInfrastructureLLMProviderService {},
  CognitiveEntry: () => null,
  ChatBubble: () => null,
  SystemResponse: () => null,
  getReadCommands: () => [],
  getExecCommands: () => [],
  useCommandCenter: () => null,
}));
jest.mock("@link-loom/react-sdk", () => ({ useOmniSearchRegisterCommand: () => {} }));

const wrapper = ({ children }) => (
  <MemoryRouter>
    <LocaleProvider dictionaries={DICTIONARIES} defaultLocale="en" storageKey={appConfig.storageKey}>
      {children}
    </LocaleProvider>
  </MemoryRouter>
);

describe("Command Center hooks", () => {
  afterEach(() => {
    globalThis.__VITE_ENV__.VITE_SOMMATIC_ENABLED = "false";
  });

  it("adds nothing to Omnisearch while the Command Center is off", () => {
    const { result } = renderHook(() => useCommandCenterSearch({ closeSearch: () => {} }), { wrapper });

    expect(result.current).toEqual({ categories: [], commands: [] });
  });

  it("hands free text to the Command Center when it is on", () => {
    globalThis.__VITE_ENV__.VITE_SOMMATIC_ENABLED = "true";
    const { result } = renderHook(() => useCommandCenterSearch({ closeSearch: () => {} }), { wrapper });

    expect(result.current.categories.map((category) => category.label)).toEqual(["Command Center"]);
  });

  it("offers the help centers its assistant only when it is on", () => {
    expect(renderHook(() => useSupportAssistant()).result.current).toBeNull();

    globalThis.__VITE_ENV__.VITE_SOMMATIC_ENABLED = "true";
    expect(renderHook(() => useSupportAssistant()).result.current.components).toHaveProperty("CognitiveEntry");
  });
});
