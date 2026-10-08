import { copyAt } from "@utils/copy.utils";

describe("copyAt", () => {
  const copy = { nav: { overview: "Overview" }, count: 3 };

  it("reads a dotted key", () => {
    expect(copyAt(copy, "nav.overview")).toBe("Overview");
  });

  it("returns the key when the text is missing or is not text", () => {
    expect(copyAt(copy, "nav.missing")).toBe("nav.missing");
    expect(copyAt(copy, "count")).toBe("count");
  });
});
