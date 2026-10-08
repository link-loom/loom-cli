import { DEFAULT_BRAND, brandAssets, mixColors, svgToJpeg } from '@link-loom/devkit';

import { authHeroSvg } from './auth-hero.js';

const AUTH_HERO_WIDTH = 720;

// Mi Retail's sign-in ground for its own palette; other brands get the same diagonal toward a tint of theirs.
export const authGradientFor = (brand) =>
  brand.primary === DEFAULT_BRAND.primary
    ? { from: '#f5f7fa', to: '#c3cfe2' }
    : { from: mixColors(brand.primary, '#f5f7fa', 0.03), to: mixColors(brand.primary, '#ffffff', 0.3) };

/**
 * Every file of a webapp that depends on the brand and is not code: logos, favicons, PWA icons, share image, web
 * manifest and the sign-in panel. `logo`, `logoDark` and `mark` are file contents when the person has their own.
 */
export const brandFiles = ({ name, description, brand, basePath, logo, logoDark, mark }) => [
  ...brandAssets({ name, description, brand, startUrl: `${basePath}/overview`, logo, logoDark, mark }),
  { path: 'public/brand/auth-hero.jpg', content: svgToJpeg(authHeroSvg(brand), AUTH_HERO_WIDTH) },
];
