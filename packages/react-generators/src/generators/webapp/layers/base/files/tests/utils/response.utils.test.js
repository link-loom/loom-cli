import { pageOf, recordOf, resultOf } from "@utils/response.utils";

describe("Link Loom answers", () => {
  it("gives the result of a successful answer", () => {
    expect(resultOf({ success: true, result: { id: "p-1" } })).toEqual({ id: "p-1" });
  });

  it("throws the backend's message, keeping the answer", () => {
    const answer = { success: false, message: "Please provide id" };

    expect(() => resultOf(answer)).toThrow("Please provide id");
    expect(() => resultOf(undefined)).toThrow();
    try {
      resultOf(answer);
    } catch (error) {
      expect(error.response).toBe(answer);
    }
  });

  it("reads a page and a record", () => {
    expect(pageOf({ items: [{ id: "a" }], totalItems: "3" })).toEqual({ items: [{ id: "a" }], totalItems: 3 });
    expect(pageOf(null)).toEqual({ items: [], totalItems: 0 });
    expect(recordOf({ items: [{ id: "a" }] })).toEqual({ id: "a" });
    expect(recordOf({ items: [] })).toBeNull();
    expect(recordOf({ id: "b" })).toEqual({ id: "b" });
  });
});
