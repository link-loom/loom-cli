const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Deep-merges `overlay` into `base`. Objects merge key by key; arrays and scalars from the overlay win. */
export const mergeJson = (base, overlay) => {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay === undefined ? base : overlay;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeJson(base[key], value) : value;
  }

  return merged;
};

/** Sets `value` at `keys` (an array of property names) and returns a new object. */
export const setJsonPath = (object, keys, value) => {
  const [head, ...rest] = keys;
  const current = isPlainObject(object) ? object : {};
  if (!rest.length) {
    return { ...current, [head]: value };
  }

  return { ...current, [head]: setJsonPath(current[head], rest, value) };
};

export const stringifyJson = (object) => `${JSON.stringify(object, null, 2)}\n`;
