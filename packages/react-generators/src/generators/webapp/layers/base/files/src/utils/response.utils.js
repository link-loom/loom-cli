/** The `result` of a Link Loom answer; a failed answer throws with the backend's message and the answer itself. */
export const resultOf = (response) => {
  if (!response?.success) {
    throw Object.assign(new Error(response?.message || ""), { response });
  }

  return response.result;
};

/** A page of a Link Loom list as the kit's lists read it: `{ items, totalItems }`. */
export const pageOf = (result) => ({
  items: Array.isArray(result?.items) ? result.items : [],
  totalItems: Number(result?.totalItems) || 0,
});

/** The record a by-id query answers: the first item of its page, or the result itself. */
export const recordOf = (result) => (Array.isArray(result?.items) ? result.items[0] : result) || null;
