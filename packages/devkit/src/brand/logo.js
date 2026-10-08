import { textToPath } from './text-path.js';

// Inter's cap height is 0.727 em: letters are centred on it, not on the em box.
const CAP_HEIGHT = 0.727;
const SVG_NS = 'http://www.w3.org/2000/svg';
const INK_LIGHT = '#1b2233';
const INK_DARK = '#ffffff';

const round = (value) => Math.round(value * 100) / 100;

/** "Acme Workspace" → "AW", "Sommatic" → "S". */
export const initialsOf = (name) => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '';
  }

  const letters = words.length > 1 ? [words[0], words[1]] : [words[0]];
  return letters.map((word) => [...word][0].toUpperCase()).join('');
};

const escapeXml = (value) => String(value).replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);

const svgDocument = ({ width, height, title, body }) =>
  `<svg xmlns="${SVG_NS}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="${escapeXml(title)}">${body}</svg>\n`;

const centredLetters = ({ text, box, fontSize, color }) => {
  const measured = textToPath(text, { size: fontSize });
  const x = (box - measured.width) / 2;
  const y = (box + CAP_HEIGHT * fontSize) / 2;
  const { d } = textToPath(text, { size: fontSize, x, y });
  return `<path fill="${color}" d="${d}"/>`;
};

/**
 * The monogram: the initials on a rounded square. `light` is for light grounds (brand square, white letters);
 * `dark` is for the brand-coloured header (white square, brand letters).
 */
export const markSvg = ({ name, primary, variant = 'light', size = 64, square = false }) => {
  const initials = initialsOf(name);
  const fill = variant === 'dark' ? INK_DARK : primary;
  const ink = variant === 'dark' ? primary : INK_DARK;
  const radius = square ? 0 : round(size * 0.22);
  const fontSize = size * (initials.length > 1 ? 0.42 : 0.5);
  const body = `<rect width="${size}" height="${size}" rx="${radius}" fill="${fill}"/>${centredLetters({ text: initials, box: size, fontSize, color: ink })}`;
  return svgDocument({ width: size, height: size, title: name, body });
};

/** The name set in Inter SemiBold, as paths. */
export const wordmarkSvg = ({ name, variant = 'light', size = 28 }) => {
  const color = variant === 'dark' ? INK_DARK : INK_LIGHT;
  const height = round(size * 1.25);
  const baseline = round((height + CAP_HEIGHT * size) / 2);
  const { d, width } = textToPath(name, { size, x: 0, y: baseline, letterSpacing: -size * 0.01 });
  return svgDocument({ width, height, title: name, body: `<path fill="${color}" d="${d}"/>` });
};

/** The children of an <svg> document, to place it inside another one. */
export const svgInner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** The full logo: the monogram beside the wordmark. */
export const logoSvg = ({ name, primary, variant = 'light', height = 40 }) => {
  const markSize = height;
  const gap = round(height * 0.3);
  const fontSize = round(height * 0.6);
  const textHeight = round(fontSize * 1.25);
  const wordmark = wordmarkSvg({ name, variant, size: fontSize });
  const wordmarkWidth = Number(/width="([\d.]+)"/.exec(wordmark)[1]);
  const body = [
    `<g>${svgInner(markSvg({ name, primary, variant, size: markSize }))}</g>`,
    `<g transform="translate(${markSize + gap} ${round((height - textHeight) / 2)})">${svgInner(wordmark)}</g>`,
  ].join('');

  return svgDocument({ width: markSize + gap + wordmarkWidth, height, title: name, body });
};
