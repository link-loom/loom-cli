import { copyText } from "@utils/clipboard.utils";

describe("copyText", () => {
  it("writes the text and answers true", async () => {
    const writeText = jest.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    await expect(copyText(42)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("42");
  });

  it("answers false when the browser refuses", async () => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });

    await expect(copyText("x")).resolves.toBe(false);
  });
});
