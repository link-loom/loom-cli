import { brandAssets } from '../../src/brand/assets.js';
import { DEFAULT_BRAND } from '../../src/brand/palette.js';
import { svgToPng } from '../../src/brand/raster.js';

const byPath = (files) => Object.fromEntries(files.map((file) => [file.path, file.content]));

describe('brand assets', () => {
  it('ships every file an app needs, in light and dark', () => {
    const files = byPath(
      brandAssets({ name: 'Acme Workspace', description: 'Operations', brand: DEFAULT_BRAND, startUrl: '/client' }),
    );

    expect(Object.keys(files).sort()).toEqual(
      [
        'public/brand/apple-touch-icon.png',
        'public/brand/favicon.ico',
        'public/brand/favicon.svg',
        'public/brand/icon-192.png',
        'public/brand/icon-512.png',
        'public/brand/logo-dark.svg',
        'public/brand/logo-light.svg',
        'public/brand/mark-dark.svg',
        'public/brand/mark-light.svg',
        'public/brand/og-default.jpg',
        'public/brand/wordmark-dark.svg',
        'public/brand/wordmark-light.svg',
        'public/site.webmanifest',
      ].sort(),
    );

    const manifest = JSON.parse(files['public/site.webmanifest']);
    expect(manifest).toMatchObject({ name: 'Acme Workspace', start_url: '/client', theme_color: '#3c4876' });
  });

  it('is deterministic, so the plan diff stays empty when nothing changed', () => {
    const first = byPath(brandAssets({ name: 'Acme', brand: DEFAULT_BRAND }));
    const second = byPath(brandAssets({ name: 'Acme', brand: DEFAULT_BRAND }));

    expect(
      Buffer.compare(
        Buffer.from(first['public/brand/og-default.jpg']),
        Buffer.from(second['public/brand/og-default.jpg']),
      ),
    ).toBe(0);
  });

  it("uses the person's logo for the logos and wordmarks, and still derives the favicons", () => {
    const own =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#000"/></svg>';
    const files = byPath(brandAssets({ name: 'Acme', brand: DEFAULT_BRAND, logo: own }));

    expect(files['public/brand/logo-light.svg']).toBe(own);
    expect(files['public/brand/wordmark-dark.svg']).toBe(own);
    expect(files['public/brand/mark-light.svg']).toContain('aria-label="Acme"');
  });

  it('accepts a PNG logo by embedding it', () => {
    const png = svgToPng(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
      10,
    );
    const files = byPath(brandAssets({ name: 'Acme', brand: DEFAULT_BRAND, logo: png }));

    expect(files['public/brand/logo-light.svg']).toContain('href="data:image/png;base64,');
  });
});
