import { mixColors } from '@link-loom/devkit';

const WIDTH = 1036;
const HEIGHT = 1856;

/**
 * The soft panel beside the sign-in and sign-up forms, like Mi Retail's: a white glow in the upper left fading into
 * a light tint of the brand colour at the bottom. Rendered to JPEG by the generator.
 */
export const authHeroSvg = (brand) => {
  const tint = mixColors(brand.primary, '#ffffff', 0.32);
  const mist = mixColors(brand.primary, '#ffffff', 0.12);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mist}"/>
      <stop offset="0.55" stop-color="${mist}"/>
      <stop offset="1" stop-color="${tint}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.38" cy="0.3" r="0.62">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ground)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
</svg>
`;
};
