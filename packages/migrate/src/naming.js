export const kebabCase = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const pascalCase = (value) =>
  kebabCase(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export const camelCase = (value) => {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/** A name without the words its folder already says: (inventory, InventoryItemList) → ItemList. */
export const withoutPrefix = (name, prefix) => {
  const prefixPascal = pascalCase(prefix);
  return name.startsWith(prefixPascal) && name.length > prefixPascal.length ? name.slice(prefixPascal.length) : name;
};
