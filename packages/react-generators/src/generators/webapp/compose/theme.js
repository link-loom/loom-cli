import { TRANSPARENT, readableOn, shiftLightness } from '@link-loom/devkit';

const BRAND_DARK_SHIFT = -0.07;

// The neutrals and states of Mi Retail's palette: what every app shares whatever its brand.
const LIGHT_NEUTRALS = Object.freeze({
  surface: '#ffffff',
  surfaceMuted: '#f2f4f8',
  surfaceSecondary: '#e4e8ef',
  hover: '#f2f4f8',
  selected: '#eceff5',
  border: '#e4e8ef',
  borderStrong: '#d3d9e3',
  textPrimary: '#1b2233',
  textSecondary: '#515d72',
  textTertiary: '#737f94',
  textDisabled: '#b3bac7',
  link: '#385dcf',
  accent: '#37b6e0',
  success: '#2fb673',
  successDark: '#24935c',
  warning: '#ffb020',
  warningDark: '#b57a0a',
  error: '#e5484d',
  errorDark: '#b8343a',
  info: '#37b6e0',
});

const DARK_NEUTRALS = Object.freeze({
  background: '#0f141c',
  surface: '#161c26',
  surfaceMuted: '#1c2330',
  surfaceSecondary: '#283142',
  hover: '#1f2734',
  selected: '#252e3d',
  border: '#283142',
  borderStrong: '#36405a',
  textPrimary: '#e7eaf0',
  textSecondary: '#aab3c2',
  textTertiary: '#8a94a6',
  textDisabled: '#5b6577',
  link: '#8fb0ff',
});

/** The palettes `src/constants/theme.js` exports, in the shape @link-loom/react-shell's ThemeModeProvider reads. */
export const themePalettes = (brand) => {
  const headerInk = readableOn(brand.header);
  const light = {
    brandPrimary: brand.primary,
    brandPrimaryDark: brand.primary === '#3c4876' ? '#2f3a5f' : shiftLightness(brand.primary, BRAND_DARK_SHIFT),
    // The ink that reads on the brand colour: text and icons on a primary button or a brand-coloured hero.
    onBrand: readableOn(brand.primary),
    header: brand.header,
    headerLogoArea: brand.logoArea,
    headerIcon: headerInk === '#ffffff' ? '#ced4da' : '#515d72',
    background: brand.background,
    footer: brand.footer || TRANSPARENT,
    ...LIGHT_NEUTRALS,
  };

  return { light, dark: { ...light, headerIcon: headerInk === '#ffffff' ? '#c9cfd8' : '#515d72', ...DARK_NEUTRALS } };
};

/** Which logo files sit on the header: white artwork on a dark header, dark artwork on a light one. */
export const headerArtwork = (brand) => (readableOn(brand.header) === '#ffffff' ? 'dark' : 'light');

/** A palette as the object literal `src/constants/theme.js` keeps it in. */
export const paletteLiteral = (palette) =>
  `{\n${Object.entries(palette)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
    .join('\n')}\n}`;

/** The source of `src/constants/theme.js`. `link-loom brand colors` rewrites the two palettes. */
export const themeModule = ({ name, brand, stoneos }) => {
  const { light, dark } = themePalettes(brand);
  const billing = stoneos
    ? `
// Billing surfaces from @link-loom/cloud-sdk draw with the app's palette, passed through \`theme\`.
export const BILLING_THEME = {
  brandPrimary: THEME_COLORS.brandPrimary,
  brandPrimaryDark: THEME_COLORS.brandPrimaryDark,
  accent: THEME_COLORS.accent,
  success: THEME_COLORS.success,
  successDark: THEME_COLORS.successDark,
  warning: THEME_COLORS.warning,
  warningDark: THEME_COLORS.warningDark,
  error: THEME_COLORS.error,
  errorDark: THEME_COLORS.errorDark,
  textPrimary: THEME_COLORS.textPrimary,
  textSecondary: THEME_COLORS.textSecondary,
  textMuted: THEME_COLORS.textTertiary,
  surface: THEME_COLORS.surface,
  surfaceMuted: THEME_COLORS.surfaceMuted,
  border: THEME_COLORS.border,
  borderDashed: THEME_COLORS.borderStrong,
};
`
    : '';

  return `/**
 * ${name}'s palette: the single source of the app's colours. The shell, Bootstrap, MUI and the Link Loom SDKs all
 * read it through ThemeModeProvider (src/App.jsx). Change it with \`npx link-loom brand colors\`, not by hand, so the
 * favicons and the share image follow.
 */
export const THEME_COLORS = ${paletteLiteral(light)};

export const THEME_COLORS_DARK = ${paletteLiteral(dark)};

// Status badge palette for the entity detail shell (positive / pending / negative).
export const STATUS_BADGE_COLORS = {
  paid: { background: "#e7f7ef", color: "#2fb673" },
  pending: { background: "#fff6e5", color: "#cc8d1a" },
  failed: { background: "#fdeaea", color: "#e5484d" },
};

// Card accents for QuickLinkCard grids (Advanced settings, Manage my app).
export const CARD_COLORS = {
  brand: THEME_COLORS.brandPrimary,
  cyan: "#37b6e0",
  coral: "#f0655c",
  green: "#2fb673",
  amber: "#ffb020",
  purple: "#8b5cf6",
  blue: "#4f8df5",
  pink: "#ef5ba1",
};
${billing}`;
};
