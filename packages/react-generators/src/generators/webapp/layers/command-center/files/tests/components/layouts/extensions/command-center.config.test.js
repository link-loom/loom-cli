import { isCommandCenterEnabled, toChipMessage } from "@components/layouts/extensions/command-center.config";

describe("Command Center config", () => {
  afterEach(() => {
    globalThis.__VITE_ENV__.VITE_SOMMATIC_ENABLED = "false";
  });

  it("runs only when the deployment turns it on", () => {
    expect(isCommandCenterEnabled()).toBe(false);
    globalThis.__VITE_ENV__.VITE_SOMMATIC_ENABLED = "true";
    expect(isCommandCenterEnabled()).toBe(true);
  });

  it("turns a slash command into the chip the Command Center shows", () => {
    expect(toChipMessage("/navigate take me to billing")).toBe("[/navigate] take me to billing");
    expect(toChipMessage("show my tasks")).toBe("show my tasks");
    expect(toChipMessage("   ")).toBeNull();
  });
});
