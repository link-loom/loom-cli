import { logoSvg, markSvg, wordmarkSvg } from './logo.js';
import { ogSvg, OG_WIDTH } from './og.js';
import { pngsToIco, svgToJpeg, svgToPng } from './raster.js';

const FAVICON_SIZES = Object.freeze([16, 32, 48]);
const PNG_SIGNATURE = '89504e470d0a1a0a';

const isPng = (content) => Buffer.from(content).subarray(0, 8).toString('hex') === PNG_SIGNATURE;

/** A PNG as an SVG that embeds it, so the same pipeline renders favicons from either format. */
const pngAsSvg = (png) => {
  const buffer = Buffer.from(png);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${buffer.toString('base64')}"/></svg>\n`;
};

const asSvg = (content) => (isPng(content) ? pngAsSvg(content) : Buffer.from(content).toString('utf8'));

/**
 * The person's own logo when they gave one, the generated one otherwise. `logo` and `logoDark` are file contents
 * (SVG or PNG); `mark` is the square symbol used for favicons and the condensed sidebar.
 */
const resolveArtwork = ({ name, brand, logo, logoDark, mark }) => {
  const generated = {
    logoLight: logoSvg({ name, primary: brand.primary, variant: 'light' }),
    logoDark: logoSvg({ name, primary: brand.header, variant: 'dark' }),
    markLight: markSvg({ name, primary: brand.primary, variant: 'light' }),
    markDark: markSvg({ name, primary: brand.header, variant: 'dark' }),
    wordmarkLight: wordmarkSvg({ name, variant: 'light' }),
    wordmarkDark: wordmarkSvg({ name, variant: 'dark' }),
  };

  const ownLight = logo ? asSvg(logo) : null;
  const ownDark = logoDark ? asSvg(logoDark) : ownLight;
  const ownMark = mark ? asSvg(mark) : null;

  return {
    logoLight: ownLight || generated.logoLight,
    logoDark: ownDark || generated.logoDark,
    markLight: ownMark || generated.markLight,
    markDark: ownMark || generated.markDark,
    wordmarkLight: ownLight || generated.wordmarkLight,
    wordmarkDark: ownDark || generated.wordmarkDark,
  };
};

export const BRAND_DIR = 'public/brand';

/**
 * Every brand file an app ships, from the name, the palette and (optionally) the person's logo: light and dark
 * logos, mark and wordmark, favicons, PWA icons, the share image and the web manifest. Returns `{ path, content }`
 * entries relative to the project root.
 */
export const brandAssets = ({ name, shortName, description = '', brand, startUrl = '/', logo, logoDark, mark }) => {
  const artwork = resolveArtwork({ name, brand, logo, logoDark, mark });
  const squareMark = mark
    ? artwork.markLight
    : markSvg({ name, primary: brand.primary, variant: 'light', square: true });
  const file = (fileName, content) => ({ path: `${BRAND_DIR}/${fileName}`, content });

  const manifest = {
    name,
    short_name: shortName || name,
    description,
    start_url: startUrl,
    display: 'standalone',
    theme_color: brand.header,
    background_color: brand.background,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };

  return [
    file('logo-light.svg', artwork.logoLight),
    file('logo-dark.svg', artwork.logoDark),
    file('mark-light.svg', artwork.markLight),
    file('mark-dark.svg', artwork.markDark),
    file('wordmark-light.svg', artwork.wordmarkLight),
    file('wordmark-dark.svg', artwork.wordmarkDark),
    file('favicon.svg', artwork.markLight),
    file('favicon.ico', pngsToIco(FAVICON_SIZES.map((size) => ({ size, data: svgToPng(artwork.markLight, size) })))),
    file('apple-touch-icon.png', svgToPng(squareMark, 180)),
    file('icon-192.png', svgToPng(artwork.markLight, 192)),
    file('icon-512.png', svgToPng(artwork.markLight, 512)),
    file('og-default.jpg', svgToJpeg(ogSvg({ name, tagline: description, brand }), OG_WIDTH)),
    { path: 'public/site.webmanifest', content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
};
