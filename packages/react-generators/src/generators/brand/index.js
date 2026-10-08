import fs from 'node:fs';
import path from 'node:path';

import {
  ERROR_CODES,
  LoomError,
  brandWarnings,
  replaceValue,
  resolveBrand,
  setProperty,
  stringifyJson,
} from '@link-loom/devkit';

import { authGradientFor, brandFiles } from '../webapp/compose/brand-files.js';
import { headerArtwork, paletteLiteral, themePalettes } from '../webapp/compose/theme.js';

const FILES = Object.freeze({
  manifest: 'loom.json',
  packageJson: 'package.json',
  theme: 'src/constants/theme.js',
  appConfig: 'src/app.config.js',
  styles: 'src/styles/index.css',
  logoLight: 'public/brand/logo-light.svg',
  logoDark: 'public/brand/logo-dark.svg',
  mark: 'public/brand/mark-light.svg',
  og: 'public/brand/og-default.jpg',
});

const readRequired = (tree, file, encoding = 'utf8') => {
  const content = tree.read(file, encoding);
  if (content === null) {
    throw new LoomError(ERROR_CODES.editShape, `${file} is missing; the brand cannot be applied`, { path: file });
  }

  return content;
};

/** Writes only what changed, so the plan lists exactly the files the new brand touches. */
const writeIfChanged = (tree, file, content) => {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  const current = tree.read(file, null);
  if (current && Buffer.compare(Buffer.from(current), next) === 0) {
    return;
  }

  if (current === null) {
    tree.create(file, next);
    return;
  }

  tree.overwrite(file, next);
};

const readOwnFile = (root, file, field) => {
  if (!file) {
    return undefined;
  }

  const fullPath = path.resolve(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new LoomError(ERROR_CODES.validation, `The ${field} file does not exist: ${file}`, {
      problems: [{ field, message: 'file not found' }],
    });
  }

  return fs.readFileSync(fullPath);
};

/** The palette after this run: the current one, or a new base, with the colours given on top. */
const nextColors = (options, current) =>
  resolveBrand({
    mode: options.brandMode,
    preset: options.brandPreset,
    seed: options.seed,
    from: options.brandMode ? undefined : current,
    colors: {
      primary: options.primaryColor,
      header: options.headerColor,
      logoArea: options.logoAreaColor,
      background: options.backgroundColor,
      footer: options.footerColor,
    },
  });

/** The person's own artwork, as the project keeps it: the files already in public/brand when the logo is theirs. */
const currentArtwork = (tree, brand) => {
  if (brand.artwork !== 'custom') {
    return {};
  }

  return {
    logo: tree.read(FILES.logoLight, null),
    logoDark: tree.read(FILES.logoDark, null),
    mark: brand.customMark ? tree.read(FILES.mark, null) : undefined,
  };
};

const applyPalette = (tree, colors) => {
  const { light, dark } = themePalettes(colors);
  let theme = readRequired(tree, FILES.theme);
  theme = replaceValue(theme, { name: 'THEME_COLORS', value: paletteLiteral(light), file: FILES.theme });
  theme = replaceValue(theme, { name: 'THEME_COLORS_DARK', value: paletteLiteral(dark), file: FILES.theme });
  writeIfChanged(tree, FILES.theme, theme);

  const artwork = headerArtwork(colors);
  let appConfig = readRequired(tree, FILES.appConfig);
  for (const [key, value] of Object.entries({
    headerWordmark: `/brand/wordmark-${artwork}.svg`,
    headerMark: `/brand/mark-${artwork}.svg`,
  })) {
    appConfig = setProperty(appConfig, { name: 'appConfig', path: ['brand', key], value, file: FILES.appConfig });
  }
  writeIfChanged(tree, FILES.appConfig, appConfig);

  const gradient = authGradientFor(colors);
  const styles = readRequired(tree, FILES.styles);
  if (!/--app-auth-from:[^;]*;/.test(styles) || !/--app-auth-to:[^;]*;/.test(styles)) {
    throw new LoomError(ERROR_CODES.editShape, `${FILES.styles} no longer declares --app-auth-from and --app-auth-to`, {
      path: FILES.styles,
      manual: `Set --app-auth-from: ${gradient.from}; and --app-auth-to: ${gradient.to}; in :root`,
    });
  }

  writeIfChanged(
    tree,
    FILES.styles,
    styles
      .replace(/--app-auth-from:[^;]*;/, `--app-auth-from: ${gradient.from};`)
      .replace(/--app-auth-to:[^;]*;/, `--app-auth-to: ${gradient.to};`),
  );
};

/**
 * `link-loom brand <colors|logo|assets|og>` on a webapp: changes the brand and rebuilds what depends on it. Colours
 * go through structural edits of theme.js and app.config.js (anything else in those files stays as it is); the
 * images are rendered again from the palette and the logo.
 */
export default async function brandGenerator(tree, options) {
  const manifest = JSON.parse(readRequired(tree, FILES.manifest));
  if (manifest.type !== 'webapp') {
    throw new LoomError(ERROR_CODES.notAvailable, '`brand` works on webapp projects', { type: manifest.type });
  }

  const packageJson = JSON.parse(readRequired(tree, FILES.packageJson));
  const brand = manifest.brand;
  const colors = options.action === 'colors' ? nextColors(options, brand.colors) : brand.colors;
  const ownLogo = options.action === 'logo';

  if (ownLogo && !options.logo) {
    throw new LoomError(ERROR_CODES.validation, 'brand logo needs --logo <file>', { missing: ['logo'], problems: [] });
  }

  const artwork = ownLogo
    ? {
        logo: readOwnFile(tree.root, options.logo, 'logo'),
        logoDark: readOwnFile(tree.root, options.logoDark, 'logoDark'),
        mark: readOwnFile(tree.root, options.mark, 'mark'),
      }
    : currentArtwork(tree, brand);

  if (options.action === 'colors') {
    applyPalette(tree, colors);
  }

  const description = options.tagline ?? packageJson.description ?? '';
  const files = brandFiles({
    name: manifest.name,
    description,
    brand: colors,
    basePath: manifest.basePath,
    ...artwork,
  });
  const selected = options.action === 'og' ? files.filter((file) => file.path === FILES.og) : files;
  for (const file of selected) {
    writeIfChanged(tree, file.path, file.content);
  }

  const nextBrand = {
    colors,
    artwork: ownLogo ? 'custom' : brand.artwork,
    customMark: ownLogo ? Boolean(options.mark) : brand.customMark,
  };
  writeIfChanged(tree, FILES.manifest, stringifyJson({ ...manifest, brand: nextBrand }));

  return {
    warnings: brandWarnings(colors),
    project: { brand: nextBrand },
    next: ['npm run dev'],
  };
}
