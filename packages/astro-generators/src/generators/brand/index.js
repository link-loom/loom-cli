import {
  ERROR_CODES,
  LoomError,
  OG_WIDTH,
  brandAssets,
  normalizeHex,
  ogSvg,
  readInputFile,
  resolveBrand,
  setProperty,
  stringifyJson,
  svgToJpeg,
} from '@link-loom/devkit';

import { landingPalette } from '../landing/compose/palette.js';
import { LANDING_FILES, LOCALES, readRequired, requireLanding, within } from '../shared/project.js';

const TOKENS = 'src/styles/_tokens.scss';
const SITE_FILE = 'src/data/site.ts';

// The tokens the palette writes, by the palette key that holds each value.
const TOKEN_KEYS = Object.freeze({
  brand: '--site-brand',
  brandAlt: '--site-brand-alt',
  accent: '--site-accent',
  accentDeep: '--site-accent-deep',
  accentSoft: '--site-accent-soft',
  accentTint: '--site-accent-tint',
  cta: '--site-brand-primary',
  ctaDark: '--site-brand-primary-dark',
});

/** Writes only what changed, so the plan lists exactly the files the new brand touches. */
const writeIfChanged = (files, file, content) => {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  const current = files.read(file, null);
  if (current && Buffer.compare(Buffer.from(current), next) === 0) return;
  if (current === null || current === undefined) {
    files.create(file, next);
    return;
  }

  files.overwrite(file, next);
};

/** The brand block of _tokens.scss with the new palette: each `--site-<token>: <value>;` line, nothing else. */
const withPalette = (tokens, palette) =>
  Object.entries(TOKEN_KEYS).reduce((source, [key, token]) => {
    const line = new RegExp(`(\\n\\s*${token}:\\s*)[^;]+;`);
    if (!line.test(source)) {
      throw new LoomError(ERROR_CODES.editShape, `${TOKENS} has no ${token}`, {
        path: TOKENS,
        manual: `Add \`${token}: ${palette[key]};\` to :root`,
      });
    }

    return source.replace(line, `$1${palette[key]};`);
  }, tokens);

const brandFilesOf = ({ manifest, brand, artwork }) => [
  ...brandAssets({
    name: manifest.name,
    description: manifest.site?.description?.en || '',
    brand,
    startUrl: `/${manifest.defaultLocale || 'en'}/`,
    ...artwork,
  }).filter((file) => !file.path.endsWith('/og-default.jpg')),
];

const shareImages = ({ manifest, brand, taglines }) =>
  LOCALES.map((locale) => ({
    path: `public/brand/og-default-${locale}.jpg`,
    content: svgToJpeg(ogSvg({ name: manifest.name, tagline: taglines[locale], brand }), OG_WIDTH),
  }));

/** `brand colors|logo|assets|og` in a landing: the tokens, the theme colour and every brand file that depends on them. */
export default async function landingBrandGenerator(tree, options, context = {}) {
  const manifest = context.project;
  requireLanding(manifest, 'brand');
  const files = within(tree, context.directory);
  const current =
    manifest.brand?.palette ||
    landingPalette({ primaryColor: '#3c4876', secondaryColor: '#54c5eb', accentColor: '#f0655c', ctaColor: '#131316' });
  const palette = landingPalette({
    primaryColor: normalizeHex(options.primaryColor || current.brand),
    secondaryColor: normalizeHex(options.secondaryColor || current.brandAlt),
    accentColor: normalizeHex(options.accentColor || current.accent),
    ctaColor: normalizeHex(options.ctaColor || current.cta),
  });
  const brand = resolveBrand({ mode: 'default', colors: { primary: palette.brand, header: palette.brand } });
  const custom = options.action === 'logo' || manifest.brand?.artwork === 'custom';
  const artwork = {
    logo: readInputFile(files.root, options.logo || (custom ? 'public/brand/logo-light.svg' : undefined), 'logo'),
    logoDark: readInputFile(
      files.root,
      options.logoDark || (custom ? 'public/brand/logo-dark.svg' : undefined),
      'logoDark',
    ),
    mark: readInputFile(files.root, options.mark, 'mark'),
  };
  if (options.action === 'logo' && !options.logo) {
    throw new LoomError(ERROR_CODES.validation, 'brand logo needs --logo <file>', { missing: ['logo'], problems: [] });
  }

  if (options.action === 'colors') {
    writeIfChanged(files, TOKENS, withPalette(readRequired(files, TOKENS), palette));
    writeIfChanged(
      files,
      SITE_FILE,
      setProperty(readRequired(files, SITE_FILE), {
        name: 'SITE',
        path: ['themeColor'],
        value: palette.brand,
        file: SITE_FILE,
      }),
    );
  }

  const taglines = {
    en: options.tagline || manifest.site?.slogan?.en || '',
    es: options.taglineEs || manifest.site?.slogan?.es || '',
  };
  const generated = [
    ...(options.action === 'og' ? [] : brandFilesOf({ manifest, brand, artwork })),
    ...shareImages({ manifest, brand, taglines }),
  ];
  for (const file of generated) {
    writeIfChanged(files, file.path, file.content);
  }

  writeIfChanged(
    files,
    LANDING_FILES.manifest,
    stringifyJson({
      ...manifest,
      brand: { ...manifest.brand, colors: brand, palette, artwork: custom ? 'custom' : 'generated' },
    }),
  );
  return { warnings: [], project: { brand: { palette, artwork: custom ? 'custom' : 'generated' } }, next: [] };
}
