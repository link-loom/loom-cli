import { normalizeText } from './text.js';

/**
 * What a request is about, by lexical cues in English and Spanish: one score per intent. The cues come from the
 * commands the CLI has; no model is involved, so this answers instantly and offline.
 */
const SERVICE_NAMES =
  /(analytics|analitica|veripass|stone ?os|command[- ]center|centro de comandos|deploy|despliegue|desplegar|image[- ]generation|generacion de imagenes)/;

const cuesFor = (domainPattern) => ({
  create_project: [
    [
      /\b(landing|webapp|web app|web application|aplicacion web|app web|monolith|monolito|monolitic\w*|microservice|microservicio|scaffold|bootstrap)\b/,
      4,
    ],
    [/\b(proyecto|project)\b/, 4],
    [
      /\b(new|nuevo|nueva|called|named|llamado|llamada|que se llame)\b.*\b(service|servicio)\b|\b(service|servicio)\b.*\b(called|named|llamado|llamada|que se llame)\b/,
      3,
    ],
  ],
  add_entity: [
    [/\b(entity|entidad|entities|entidades|crud)\b/, 4],
    [/\b(manage|gestionar|administrar)\b/, 3],
    [
      /(compact|compacta|tarjetas|\bcards\b|quick ?view|vista rapida|copy id|copiar id|copy link|copiar enlace|new tab|pestana|\bedit\b|editar|eliminar|\bdelete\b)/,
      1,
    ],
  ],
  add_page: [
    [/\b(page|pagina|screen|pantalla)\b/, 4],
    [/\b(route|ruta)\b/, 1],
  ],
  add_component: [[/\b(component|componente|widget)\b/, 4]],
  add_service: [
    [/\b(service|servicio)\b/, 2],
    [new RegExp(`\\b(service|servicio)\\b.*${domainPattern}|${domainPattern}.*\\b(service|servicio)\\b`), 3],
    [/\b(service|servicio)\s+(backend\s+)?(for|of|de|para)\b/, 3],
    [/\b(backend)\b/, 1],
  ],
  brand_colors: [
    [/\b(color|colour|colors|colores|paleta|palette|brand colors|colores de la marca)\b|#[0-9a-f]{3,8}\b/, 4],
    [/\b(primary|primario|principal|header|footer|background|fondo|encabezado|pie)\b/, 1],
  ],
  images_generate: [[/\b(image|images|imagen|imagenes|picture|foto|hero|opengraph|og)\b/, 4]],
  services_add: [
    [SERVICE_NAMES, 4],
    [
      /\b(integracion|integration|integrate|integrar|enable|habilita|habilitar|activa|activar|conecta|hook up|connect|integrations)\b/,
      3,
    ],
    [/\b(external service|servicio externo|integrations)\b/, 1],
  ],
  update_stack: [
    [/\b(stack|dependencies|dependencias|upgrade|versions|versiones)\b/, 4],
    [/\b(update|updates|actualiza|actualizar|actualizacion|actualizaciones)\b/, 3],
  ],
  check_project: [
    [
      /\b(validate|valida|validar|check|verifica|verificar|diagnos\w*|health|healthy|configurad[oa]|chequeo|lint|revisa|revisar)\b/,
      4,
    ],
  ],
  add_section: [
    [
      /\b(section|sections|seccion|secciones|bloque|banda|band|faq|preguntas frecuentes|testimonials|testimonios|logos|logotipos)\b/,
      4,
    ],
    [/\b(cards|tarjetas|hero|cta|call to action|llamado a la accion|cierre)\b/, 2],
  ],
  add_blog_post: [[/\b(post|posts|blog|articulo|articulos|entrada|publicacion|publicaciones)\b/, 4]],
});

// What each project type can do: intents of the other types never win.
const LANDING_ONLY = Object.freeze(['add_section', 'add_blog_post']);
const WEBAPP_ONLY = Object.freeze(['add_entity', 'add_component', 'add_service', 'brand_colors']);

const HELP =
  /^[\s¿¡]*(explain|explicame|explica|what is|what's|que es|cual es|how (do|does|can)|como (se|puedo|funciona)|difference|diferencia)\b|\b(la diferencia entre|the difference between)\b/;

/** Whether the person asks how something works rather than asking for it to be done. */
export const isHelpRequest = (text) => HELP.test(normalizeText(text));

const tidy = (text) =>
  text
    .replace(/\b(open|abrir)\s+(the\s+|la\s+)?(page|pagina)\b/g, ' ')
    .replace(/\blanding page\b/g, 'landing')
    .replace(/\b(open ?graph)\b/g, 'opengraph');

/** One score per intent; the disambiguation keeps a word shared by two intents from pulling the wrong one. */
export const intentScores = (original, { domains = [], type } = {}) => {
  const text = tidy(normalizeText(original));
  const domainPattern = `\\b(${[...new Set([...domains, 'inventory', 'inventario', 'security', 'seguridad', 'management', 'gestion', 'administracion'])].join('|')})\\b`;
  const domainNamed = new RegExp(domainPattern).test(text);
  const scores = Object.fromEntries(
    Object.entries(cuesFor(domainPattern)).map(([intent, cues]) => [
      intent,
      cues.reduce((sum, [pattern, weight]) => sum + (pattern.test(text) ? weight : 0), 0),
    ]),
  );
  const serviceFor = /\b(service|servicio)\s+(backend\s+)?(for|of|de|para)\b/.test(text);
  // "del proyecto", "the project": the one that exists, not a new one.
  const existingProject = /\b(del|al|el|the|this|este|mi|my|our|nuestro)\s+(proyecto|project)\b/.test(text);
  if (
    existingProject &&
    !/\b(landing|webapp|web app|aplicacion web|app web|monolith|monolito|microservice|microservicio)\b/.test(text)
  ) {
    scores.create_project = Math.max(0, scores.create_project - 4);
  }

  if (scores.services_add >= 4 && scores.add_service > 0 && !serviceFor) scores.add_service = 0;
  if (scores.services_add >= 4 && /\b(image[- ]generation|generacion de imagenes)\b/.test(text))
    scores.images_generate = 0;
  if (scores.update_stack >= 4 && scores.check_project > 0) scores.check_project = 0;
  if (scores.add_entity >= 4 && scores.add_service >= 4) scores.add_entity = 0;
  if (scores.add_entity >= 4) scores.add_service = Math.min(scores.add_service, 3);
  if (scores.add_component >= 4 || scores.add_page >= 4) {
    scores.add_entity = Math.min(scores.add_entity, 3);
    scores.create_project = Math.min(scores.create_project, 3);
  }
  if (
    scores.create_project >= 3 &&
    scores.add_service > 0 &&
    !domainNamed &&
    !/\b(entity|entidad)\b/.test(text) &&
    !serviceFor
  ) {
    scores.add_service = 0;
  }
  if (scores.add_service > 0 && scores.create_project >= 2 && !domainNamed) scores.add_service = 0;
  // "a FAQ section on the pricing page": the page is where it goes, the section is what is asked; a hero section is
  // a section, not an image.
  if (scores.add_section >= 4) {
    scores.add_page = Math.min(scores.add_page, 3);
    scores.images_generate = Math.min(scores.images_generate, 3);
  }
  if (scores.add_blog_post >= 4 && !/\b(section|seccion)\b/.test(text)) scores.add_page = Math.min(scores.add_page, 3);
  const unavailable = type === 'landing' ? WEBAPP_ONLY : LANDING_ONLY;
  unavailable.forEach((intent) => {
    scores[intent] = 0;
  });
  return scores;
};

/** The intent a request asks for, or none when no cue is strong enough; `margin` says how clear the choice was. */
export const routeByRules = (original, { domains = [], type, minScore = 3 } = {}) => {
  if (isHelpRequest(original)) {
    return { intent: null, score: 0, margin: 0, help: true };
  }

  const ranked = Object.entries(intentScores(original, { domains, type })).sort((left, right) => right[1] - left[1]);
  const [[intent, score], [, runnerUp]] = ranked;
  return { intent: score >= minScore ? intent : null, score, margin: score - runnerUp, help: false };
};
