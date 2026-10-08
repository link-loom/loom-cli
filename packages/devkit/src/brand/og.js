import { markSvg, svgInner } from './logo.js';
import { measureText, textToPath } from './text-path.js';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PADDING = 96;
const TEXT_WIDTH = OG_WIDTH - PADDING * 2;
const NAME_SIZE = 72;
const TAGLINE_SIZE = 32;
const TAGLINE_LINE_HEIGHT = 44;
const MAX_TAGLINE_LINES = 2;

/** The largest size, up to `size`, at which `text` fits in the text column. */
const fittingSize = (text, size, weight) => {
  const width = measureText(text, { size, weight });
  return width <= TEXT_WIDTH ? size : Math.floor((size * TEXT_WIDTH) / width);
};

/** Breaks the tagline into at most two lines; the second ends in an ellipsis when the text does not fit. */
const wrapTagline = (tagline) => {
  const lines = [];
  let current = '';

  for (const word of String(tagline).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, { size: TAGLINE_SIZE, weight: 400 }) <= TEXT_WIDTH) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  lines.push(current);
  const kept = lines.filter(Boolean).slice(0, MAX_TAGLINE_LINES);
  const overflowed = lines.filter(Boolean).length > MAX_TAGLINE_LINES;
  return overflowed ? [...kept.slice(0, -1), `${kept.at(-1)}…`] : kept;
};

/**
 * The share image (1200×630): the brand header colour, the monogram, the name and the tagline, all as paths so it
 * renders without fonts installed. A page's own image passes its title as `name` and the site's as `markName`.
 */
export const ogSvg = ({ name, tagline = '', brand, markName = name }) => {
  const nameSize = fittingSize(name, NAME_SIZE, 600);
  const markSize = 96;
  const mark = `<g transform="translate(${PADDING} 150)">${svgInner(markSvg({ name: markName, primary: brand.header, variant: 'dark', size: markSize }))}</g>`;
  const nameBaseline = 150 + markSize + 48 + nameSize * 0.75;
  const namePath = textToPath(name, { size: nameSize, x: PADDING, y: nameBaseline, letterSpacing: -nameSize * 0.01 });
  const taglinePaths = wrapTagline(tagline).map((line, index) =>
    textToPath(line, {
      size: TAGLINE_SIZE,
      weight: 400,
      x: PADDING,
      y: nameBaseline + 64 + index * TAGLINE_LINE_HEIGHT,
    }),
  );

  const body = [
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${brand.header}"/>`,
    `<rect y="${OG_HEIGHT - 12}" width="${OG_WIDTH}" height="12" fill="${brand.logoArea}"/>`,
    mark,
    `<path fill="#ffffff" d="${namePath.d}"/>`,
    ...taglinePaths.map((path) => `<path fill="#ffffff" fill-opacity="0.78" d="${path.d}"/>`),
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">${body}</svg>\n`;
};
