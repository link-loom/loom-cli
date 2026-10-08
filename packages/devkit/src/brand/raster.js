import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';

const render = (svg, width, background) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, background, font: { loadSystemFonts: false } }).render();

/** An SVG rendered to PNG at `width` pixels, keeping transparency. */
export const svgToPng = (svg, width) => render(svg, width).asPng();

/** An SVG rendered to JPEG at `width` pixels over `background` (JPEG has no transparency). */
export const svgToJpeg = (svg, width, { quality = 88, background = '#ffffff' } = {}) => {
  const image = render(svg, width, background);
  return jpeg.encode({ data: image.pixels, width: image.width, height: image.height }, quality).data;
};

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

/**
 * A .ico that wraps PNG images, which every current browser reads: a header, one directory entry per
 * size, then the PNG bytes as they are.
 */
export const pngsToIco = (images) => {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => Buffer.from(data))]);
};
