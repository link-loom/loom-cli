import { findParityGaps } from "@link-loom/react-shell";

import en from "@i18n/en";
import es from "@i18n/es";

describe("copy", () => {
  it("has the same keys in English and Spanish", () => {
    expect(findParityGaps({ en, es })).toEqual({});
  });

  it("has no empty text left in either language", () => {
    const empty = (tree, prefix = "") =>
      Object.entries(tree).flatMap(([key, value]) =>
        typeof value === "object" ? empty(value, `${prefix}${key}.`) : value === "" ? [`${prefix}${key}`] : []
      );

    expect(empty(en).filter((key) => key !== "app.description" && !key.endsWith("heroSubtitle"))).toEqual([]);
    expect(empty(es).filter((key) => key !== "app.description" && !key.endsWith("heroSubtitle"))).toEqual([]);
  });
});
