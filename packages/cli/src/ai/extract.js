import { domainWords, entityOf, normalizeText } from './text.js';

/**
 * The arguments of a request for one intent, read from its words: names after "called"/"llamado", kebab-case
 * tokens, hex colours by the role named before them, list presets and row actions by their names in both languages.
 * Nothing is invented: what is not in the request stays out, and the TUI asks for it.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'in',
  'of',
  'for',
  'with',
  'new',
  'add',
  'create',
  'la',
  'el',
  'un',
  'una',
  'al',
  'en',
  'de',
  'del',
  'con',
  'para',
  'nueva',
  'nuevo',
  'entity',
  'entidad',
  'backend',
  'entities',
  'domain',
  'dominio',
  'called',
  'named',
  'llamada',
  'llamado',
  'shared',
  'compartido',
  'componente',
  'component',
  'page',
  'pagina',
  'que',
  'se',
  'los',
  'las',
  'as',
  'como',
  'at',
  'service',
  'servicio',
  'my',
  'mi',
  'this',
  'esta',
  'este',
  'another',
  'otro',
  'otra',
  'some',
  'algun',
  'alguna',
]);

const WORD = '([a-z0-9][a-z0-9_-]*)';

const firstMatch = (text, patterns, blocked = new Set()) => {
  for (const pattern of patterns) {
    const found = text.match(new RegExp(pattern, 'i'));
    if (found && !STOPWORDS.has(found[1]) && !blocked.has(found[1])) {
      return found[1];
    }
  }

  return undefined;
};

const findDomain = (text, words) => {
  for (const [word, domain] of words) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      return domain;
    }
  }

  const explicit = text.match(new RegExp(`\\b(?:domain|dominio)\\s+${WORD}`));
  return explicit && !STOPWORDS.has(explicit[1]) ? explicit[1] : undefined;
};

const findName = (text, kind, blocked) => {
  const called = firstMatch(text, [
    `(?:called|named|llamad[oa]|que se llame|que se llama|nombre|con el nombre)\\s+${WORD}`,
  ]);
  if (called) {
    return called;
  }

  const hyphenated = text.match(/\b([a-z0-9]+(?:-[a-z0-9]+)+)\b/);
  if (hyphenated) {
    return hyphenated[1];
  }

  if (kind === 'project') {
    return undefined;
  }

  return firstMatch(
    text,
    [`${WORD}\\s+(?:page|component)\\b`, `(?:page|component)\\s+${WORD}`, `(?:pagina|componente)\\s+${WORD}`],
    blocked,
  );
};

const findPath = (text) => text.match(/(?:^|\s)(\/[a-z0-9_\-/]*)/i)?.[1];

const COLOR_ROLES = [
  ['primary', /(primary|primario|principal)/g],
  ['header', /(header|encabezado|cabecera)/g],
  ['background', /(background|fondo)/g],
  ['footer', /(footer|pie)/g],
];

/** Each hex colour, assigned to the last role named before it. */
const findColors = (text) => {
  const result = {};
  let cursor = 0;
  for (const hex of text.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    const segment = text.slice(cursor, hex.index);
    let best;
    for (const [role, pattern] of COLOR_ROLES) {
      for (const match of segment.matchAll(pattern)) {
        if (!best || match.index >= best.index) {
          best = { role, index: match.index };
        }
      }
    }

    if (best) {
      result[best.role] = hex[0].toLowerCase();
    }

    cursor = hex.index + hex[0].length;
  }

  return result;
};

const ROW_ACTIONS = [
  ['quickview', /(quick ?view|vista rapida|vista previa|ver rapido|quick look)/],
  ['edit', /\b(edit|editar|edicion)\b/],
  ['open-new-tab', /(new tab|nueva pestana|pestana nueva|nueva ventana)/],
  ['open-page', /(open (?:the )?page|abrir (?:la )?pagina)/],
  ['copy-id', /(copy (?:the )?id|copiar (?:el )?id)\b/],
  ['copy-link', /(copy (?:the )?link|copiar (?:el )?(?:enlace|link|vinculo))/],
  ['delete', /\b(delete|eliminar|borrar|remove)\b/],
];

const SERVICES = [
  ['image-generation', /(image[- ]generation|generacion de imagenes|generar imagenes|imagenes con ia)/],
  ['analytics', /(analytics|analitica)/],
  ['deploy', /(deploy|despliegue|desplegar)/],
  ['veripass', /veripass/],
  ['stoneos', /stone ?os/],
  ['command-center', /(command[- ]center|centro de comandos)/],
];

const EXTRACTORS = {
  create_project: (text) => {
    const args = {};
    if (/\blanding\b/.test(text)) args.type = 'landing';
    else if (/(webapp|web app|web application|aplicacion web|app web)/.test(text)) args.type = 'webapp';
    else if (/(service|servicio|microservice|microservicio|monolith|monolito|backend)/.test(text))
      args.type = 'service';
    if (args.type === 'webapp' && /(\badmin\b|administracion|administrador|administrative)/.test(text))
      args.variant = 'admin';
    else if (args.type === 'webapp' && /(\bclient\b|\bcliente\b|\bclientes\b)/.test(text)) args.variant = 'client';
    if (args.type === 'service' && /(microservice|microservicio)/.test(text)) args.shape = 'microservice';
    else if (args.type === 'service' && /(monolith|monolito|monolitic)/.test(text)) args.shape = 'monolith';
    const name = findName(text, 'project');
    return name ? { ...args, name } : args;
  },
  add_entity: (text, words) => {
    const args = {};
    const domain = findDomain(text, words);
    if (domain) args.domain = domain;
    const entity = firstMatch(
      text,
      [
        `crud\\s+(?:for|of|de|para)\\s+(?:the\\s+|los\\s+|las\\s+)?${WORD}`,
        `(?:entity|entidad)\\s+(?:called\\s+|named\\s+|llamada\\s+)?${WORD}`,
        `${WORD}\\s+(?:entity|entidad)`,
        `(?:manage|gestionar|administrar)\\s+(?:the\\s+|los\\s+|las\\s+)?${WORD}`,
      ],
      new Set(words.keys()),
    );
    if (entity) args.entity = entityOf(entity);
    if (/(compact|compacta|compacto)/.test(text)) args.list = 'compact';
    else if (/(\bcards?\b|tarjetas?)/.test(text)) args.list = 'cards';
    else if (/(standard|estandar)/.test(text)) args.list = 'standard';
    const actions = ROW_ACTIONS.filter(([, pattern]) => pattern.test(text)).map(([action]) => action);
    return actions.length ? { ...args, actions } : args;
  },
  add_page: (text, words) => {
    const args = {};
    const domain = findDomain(text, words);
    if (domain) args.domain = domain;
    const name = findName(text, 'page', new Set(words.keys()));
    if (name) args.name = name;
    const path = findPath(text);
    return path ? { ...args, path } : args;
  },
  add_component: (text, words) => {
    const args = {};
    const domain = findDomain(text, words);
    if (domain) args.domain = domain;
    const name = findName(text, 'component', new Set(words.keys()));
    if (name) args.name = name;
    if (/(quick actions|acciones rapidas)/.test(text)) args.role = 'quick-actions';
    else if (/(shared|compartid)/.test(text)) args.role = 'shared';
    else if (/(\bfor the list\b|\bpara la lista\b|\blist\b|\blista\b)/.test(text)) args.role = 'list';
    else if (/(\brecord\b|\bregistro\b|\bdetalle\b|\bdetail\b)/.test(text)) args.role = 'record';
    return args;
  },
  add_service: (text, words) => {
    const args = {};
    const domain = findDomain(text, words);
    if (domain) args.domain = domain;
    const entity = firstMatch(
      text,
      [
        `service\\s+(?:for|of)\\s+(?:the\\s+)?(?:entity\\s+)?${WORD}`,
        `servicio\\s+(?:backend\\s+)?(?:de|para)\\s+(?:la\\s+|el\\s+)?(?:entidad\\s+)?${WORD}`,
        `(?:entity|entidad)\\s+${WORD}`,
        `the\\s+${WORD}\\s+service`,
        `${WORD}\\s+service`,
      ],
      new Set(words.keys()),
    );
    return entity ? { ...args, entity: entityOf(entity) } : args;
  },
  brand_colors: (text) => {
    const args = findColors(text);
    if (/(random|aleatori|al azar)/.test(text)) args.preset = 'random';
    else if (/(\bdefault\b|predeterminad|por defecto|originales)/.test(text)) args.preset = 'default';
    return args;
  },
  images_generate: (text) => {
    if (/(opengraph|\bog\b|social|redes)/.test(text)) return { target: 'og' };
    if (/(\ball\b|todas|todo|every|\bentire\b)/.test(text)) return { target: 'all' };
    return /(\bhero\b|principal)/.test(text) ? { target: 'hero' } : {};
  },
  services_add: (text) => {
    const found = SERVICES.find(([, pattern]) => pattern.test(text));
    return found ? { service: found[0] } : {};
  },
  update_stack: (text) =>
    /(only check|just check|check only|solo revisa|solo verifica|solo comprueba|sin aplicar|without applying|dry run)/.test(
      text,
    )
      ? { check: true }
      : {},
  check_project: () => ({}),
  add_section: (text) => {
    const args = { page: findSectionPage(text) };
    const kind = SECTION_KINDS.find(([, pattern]) => pattern.test(text));
    if (kind) args.kind = kind[0] === 'hero' && args.page !== 'home' ? 'page-hero' : kind[0];
    if (args.kind === 'final-cta' && args.page !== 'home') args.kind = 'page-cta';
    const id = firstMatch(text, [`(?:called|named|llamad[oa]|id)\\s+${WORD}`]);
    return id ? { ...args, id } : args;
  },
  add_blog_post: (text, words, original) => {
    const title =
      quotedIn(original) || titleAfter(text, ['titled', 'called', 'titulad[oa]', 'llamad[oa]', 'sobre', 'about']);
    return title ? { titleEn: title, slug: slugOf(title) } : {};
  },
};

const SECTION_KINDS = [
  ['faq', /\b(faq|preguntas frecuentes|questions)\b/],
  ['logos', /\b(logos|logotipos|clientes que confian|trusted by)\b/],
  ['split', /\b(split|image beside|imagen al lado|imagen a un lado|two columns|dos columnas)\b/],
  ['prose', /\b(prose|text|texto|parrafos|paragraphs)\b/],
  ['final-cta', /\b(cta|call to action|llamado a la accion|cierre|closing)\b/],
  ['hero', /\bhero\b/],
  ['cards', /\b(cards|tarjetas|benefits|beneficios|features|caracteristicas)\b/],
];

const findSectionPage = (text) => {
  if (/\b(home|homepage|inicio|portada)\b/.test(text)) return 'home';
  const named =
    text.match(new RegExp(`(?:pagina|page)\\s+(?:de\\s+)?${WORD}`)) || text.match(new RegExp(`${WORD}\\s+page\\b`));
  return named && !STOPWORDS.has(named[1]) && !/^(the|a|la)$/.test(named[1]) ? named[1] : 'home';
};

const quotedIn = (original) => /["“”«»']([^"“”«»']{3,})["“”«»']/.exec(String(original))?.[1];

const titleAfter = (text, words) => {
  const found = text.match(new RegExp(`\\b(?:${words.join('|')})\\s+(.{3,80})$`));
  return found ? found[1].trim() : undefined;
};

const slugOf = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A landing's page: its path from the word that names it, its title from that word, and where it is linked. */
const landingPage = (text) => {
  const name = findName(text, 'page');
  const path = findPath(text) || (name ? `/${name}` : undefined);
  const args = {};
  if (path) args.path = path.startsWith('/') ? path : `/${path}`;
  const word = (name || path?.split('/').pop() || '').replace(/-/g, ' ');
  if (word) args.titleEn = word.charAt(0).toUpperCase() + word.slice(1);
  if (/\b(menu|header|encabezado|navigation|navegacion)\b/.test(text)) args.nav = 'header';
  else if (/\b(footer|pie de pagina|pie)\b/.test(text)) args.nav = 'footer:company';
  return args;
};

/**
 * The options of a list a person names in their own words: the row actions by their names in both languages, any
 * other option by its value or its label. What they did not name stays unmarked.
 */
export const optionsIn = (request, options, field) => {
  const text = normalizeText(request);
  if (field === 'actions') {
    const named = new Set(ROW_ACTIONS.filter(([, pattern]) => pattern.test(text)).map(([action]) => action));
    return options.filter((option) => named.has(option.key));
  }

  return options.filter((option) =>
    [option.key.replace(/-/g, ' '), normalizeText(option.label)].some((name) => name && text.includes(name)),
  );
};

/** The arguments of `intent` found in `request`; `domains` are the project's, so their names resolve. */
export const extractArguments = (intent, request, { domains = [], type } = {}) => {
  const text = normalizeText(request).replace(/\b(open ?graph)\b/g, 'opengraph');
  if (intent === 'add_page' && type === 'landing') {
    return landingPage(text);
  }

  return EXTRACTORS[intent] ? EXTRACTORS[intent](text, domainWords(domains), request) : {};
};
