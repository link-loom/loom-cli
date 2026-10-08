/** Lower case without accents: how the rules read what a person typed, in English or Spanish. */
export const normalizeText = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SPANISH_DOMAINS = Object.freeze({
  inventario: 'inventory',
  seguridad: 'security',
  gestion: 'management',
  administracion: 'management',
  reportes: 'reports',
  informes: 'reports',
  ventas: 'sales',
  finanzas: 'finance',
  compras: 'purchasing',
  facturacion: 'billing',
  operaciones: 'operations',
});

// The Spanish words people use for the entities they manage, in the singular English the backend uses.
const SPANISH_ENTITIES = Object.freeze({
  proveedor: 'supplier',
  cliente: 'customer',
  producto: 'product',
  factura: 'invoice',
  pedido: 'order',
  usuario: 'user',
  contacto: 'contact',
  proyecto: 'project',
  tarea: 'task',
  bodega: 'warehouse',
  almacen: 'warehouse',
  empleado: 'employee',
  agente: 'agent',
});

export const singularOf = (word) => {
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
};

/** An entity as the backend names it: singular, English when the word is a known Spanish one. */
export const entityOf = (raw) => {
  if (!raw) {
    return undefined;
  }

  const spanishPlural = raw.endsWith('es') ? raw.slice(0, -2) : raw;
  return (
    SPANISH_ENTITIES[raw] ?? SPANISH_ENTITIES[singularOf(raw)] ?? SPANISH_ENTITIES[spanishPlural] ?? singularOf(raw)
  );
};

/**
 * The words that name a domain in a request: the project's own domains, and the Spanish words of the usual ones. An
 * English word that is not a domain of the project is left alone, so a page called "reports" stays a name.
 */
export const domainWords = (domains = []) => {
  const known = new Map(domains.map((domain) => [domain, domain]));
  for (const [spanish, english] of Object.entries(SPANISH_DOMAINS)) {
    known.set(spanish, english);
  }

  return known;
};
