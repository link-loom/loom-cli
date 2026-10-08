/** The text at a dotted key of a copy tree (`"nav.overview"`), or the key itself when it is missing. */
export const copyAt = (copy, key) => {
  const value = String(key)
    .split(".")
    .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), copy);

  return typeof value === "string" ? value : key;
};
