import { extractArguments } from './extract.js';
import { routeByRules } from './rules.js';
import { MIN_SIMILARITY, semanticIntent } from './semantic.js';

/** What each intent cannot do without. A proposal missing one of them asks for it instead of guessing. */
export const REQUIRED = Object.freeze({
  create_project: ['type', 'name'],
  add_entity: ['domain', 'entity'],
  add_page: ['domain', 'name'],
  add_component: ['domain', 'name'],
  add_service: ['domain', 'entity'],
  brand_colors: [],
  images_generate: [],
  services_add: ['service'],
  update_stack: [],
  check_project: [],
  add_section: ['kind'],
  add_blog_post: ['slug', 'titleEn'],
});

// A landing's page is named by its address and title, not by a domain.
const LANDING_REQUIRED = Object.freeze({ add_page: ['path', 'titleEn'] });

// The services a request names, as the CLI's catalog calls them.
const SERVICE_IDS = Object.freeze({
  'image-generation': 'image-generation',
  deploy: 'cloudflare-pages',
  veripass: 'veripass',
  stoneos: 'link-loom-cloud',
  'command-center': 'sommatic',
});

const pascal = (value) =>
  String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const option = (flag, value) =>
  value === undefined || value === '' ? [] : [flag, Array.isArray(value) ? value.join(',') : String(value)];

/** The CLI command an intent and its arguments stand for, as argv. */
const ARGV = {
  create_project: (args) => [
    'create',
    args.type,
    ...option('--name', args.name),
    ...option('--variant', args.variant),
    ...option('--shape', args.shape),
  ],
  add_entity: (args) => [
    'add',
    'entity',
    ...option('--domain', args.domain),
    ...option('--entity', args.entity),
    ...option('--list', args.list),
    ...option('--actions', args.actions),
  ],
  add_page: (args) => [
    'add',
    'page',
    ...option('--domain', args.domain),
    ...option('--name', args.name),
    ...option('--path', args.path?.replace(/^\//, '')),
  ],
  add_component: (args) => [
    'add',
    'component',
    ...option('--name', args.name && pascal(args.name)),
    ...option('--domain', args.domain),
  ],
  add_service: (args) => ['add', 'service', ...option('--domain', args.domain), ...option('--entity', args.entity)],
  brand_colors: (args) => [
    'brand',
    'colors',
    ...option('--primary-color', args.primary),
    ...option('--header-color', args.header),
    ...option('--background-color', args.background),
    ...option('--footer-color', args.footer),
    ...option('--brand-mode', args.preset),
  ],
  images_generate: (args) =>
    args.target === 'og' ? ['images', 'og'] : ['images', 'generate', ...(args.target === 'hero' ? ['hero'] : [])],
  services_add: (args) => ['services', 'add', SERVICE_IDS[args.service] ?? args.service],
  update_stack: (args) => ['update', ...(args.check ? ['--check'] : [])],
  check_project: () => ['check'],
  add_section: (args) => [
    'add',
    'section',
    ...option('--page', args.page),
    ...option('--kind', args.kind),
    ...option('--id', args.id),
  ],
  add_blog_post: (args) => ['add', 'blog-post', ...option('--slug', args.slug), ...option('--title-en', args.titleEn)],
};

const LANDING_ARGV = {
  add_page: (args) => [
    'add',
    'page',
    ...option('--path', args.path),
    ...option('--title-en', args.titleEn),
    ...option('--nav', args.nav),
  ],
};

const quote = (value) => (/^[\w./@:,#-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`);

/** The proposal for a request once its intent is known: its arguments, what is missing, and the command. */
const proposalFor = (intent, text, { domains = [], type } = {}, confidence = 'high') => {
  const args = extractArguments(intent, text, { domains, type });
  const landing = type === 'landing';
  const required = (landing && LANDING_REQUIRED[intent]) || REQUIRED[intent];
  const missing = required.filter((field) => args[field] === undefined || args[field] === '');
  const toArgv = (landing && LANDING_ARGV[intent]) || ARGV[intent];
  const argv = missing.length ? null : toArgv(args).filter(Boolean);
  return {
    intent,
    args,
    missing,
    confidence,
    argv,
    command: argv ? `link-loom ${argv.map(quote).join(' ')}` : null,
  };
};

/**
 * A command for what a person typed: `{ intent, args, missing, argv, command }`, or `{ help: true }` when they asked
 * how something works, or null when nothing the CLI does matches. It only proposes: the TUI shows the plan and asks
 * for whatever is missing before anything runs.
 */
export const proposeCommand = (text, { domains = [], type } = {}) => {
  const route = routeByRules(text, { domains, type });
  if (route.help) {
    return { help: true };
  }

  if (!route.intent) {
    return null;
  }

  return proposalFor(route.intent, text, { domains, type }, route.margin >= 1 ? 'high' : 'low');
};

/**
 * The same, with the sentence encoder when it is installed: it decides when the rules are not sure (no intent, or a
 * close second), and turns down a request that is close to nothing the CLI does. Without it, the rules alone.
 */
export const proposeCommandWithModel = async (text, context = {}, embedder = null) => {
  const byRules = proposeCommand(text, context);
  if (!embedder || byRules?.help || byRules?.confidence === 'high') {
    return byRules;
  }

  const semantic = await semanticIntent(embedder, text, context);
  if (!semantic || semantic.similarity < MIN_SIMILARITY) {
    return null;
  }

  return proposalFor(semantic.intent, text, context, byRules?.intent === semantic.intent ? 'high' : 'low');
};
