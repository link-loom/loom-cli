import { markSvg } from '../../src/brand/logo.js';
import { pngsToIco, svgToJpeg, svgToPng } from '../../src/brand/raster.js';

const svg = markSvg({ name: 'Acme', primary: '#3c4876' });

describe('brand rasters', () => {
  it('renders PNG at the requested width', () => {
    const png = svgToPng(svg, 48);

    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(48);
  });

  it('renders JPEG', () => {
    const jpg = svgToJpeg(svg, 64);

    expect(jpg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  });

  it('packs PNG images into an .ico directory', () => {
    const images = [16, 32].map((size) => ({ size, data: svgToPng(svg, size) }));
    const ico = pngsToIco(images);

    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 16 * 2);
    expect(ico.length).toBe(6 + 16 * 2 + images[0].data.length + images[1].data.length);
  });
});
