const words = (value) =>
  String(value)
    .split(/[-_\s]+/)
    .filter(Boolean);

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** `api-key` → `ApiKey`. */
export const pascalCase = (value) => words(value).map(capitalize).join('');

/** `api-key` → `apiKey`. */
export const camelCase = (value) => {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/** `api-key` → `Api key`: the default English label, to be replaced by real copy. */
export const sentenceCase = (value) => capitalize(words(value).join(' '));

/** The plural of a kebab-case English noun, for the route: `product` → `products`, `category` → `categories`. */
export const pluralOf = (value) => {
  if (/[^aeiou]y$/.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/.test(value)) {
    return `${value}es`;
  }

  return `${value}s`;
};

/** Every name a generated file needs for one entity of a domain. */
export const entityNames = ({ domain, entity, plural }) => {
  const prefix = `${pascalCase(domain)}${pascalCase(entity)}`;
  const routePlural = plural || pluralOf(entity);
  return {
    domain,
    entity,
    plural: routePlural,
    Domain: pascalCase(domain),
    Entity: pascalCase(entity),
    Prefix: prefix,
    domainKey: camelCase(domain),
    entityKey: camelCase(entity),
    copyPath: `${camelCase(domain)}.${camelCase(entity)}`,
    entityType: `${domain}-${entity}`,
    listPath: `/${domain}/${routePlural}`,
    serviceClass: `${prefix}Service`,
    serviceFile: `${domain}-${entity}.service`,
    utilsFile: `${domain}-${entity}.utils`,
    routesFile: `${domain}-${entity}.routes`,
  };
};

/** A label as it reads inside a sentence: `Product` → `product`, while `API key` keeps its acronym. */
export const inlineOf = (label) =>
  /^.[A-Z]/.test(label) ? label : `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
