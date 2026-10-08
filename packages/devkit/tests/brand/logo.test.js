import { initialsOf, logoSvg, markSvg, wordmarkSvg } from '../../src/brand/logo.js';
import { measureText, textToPath } from '../../src/brand/text-path.js';

describe('generated logo', () => {
  it('takes one initial per word, up to two', () => {
    expect(initialsOf('Acme Workspace')).toBe('AW');
    expect(initialsOf('Sommatic')).toBe('S');
    expect(initialsOf('êtrune id platform')).toBe('ÊI');
  });

  it('sets text as paths, including letters outside the basic latin subset', () => {
    const { d, width } = textToPath('Łódź', { size: 20 });

    expect(d).toMatch(/^M/);
    expect(width).toBeCloseTo(measureText('Łódź', { size: 20 }), 5);
  });

  it('draws the mark with brand ground on light and white ground on the brand header', () => {
    expect(markSvg({ name: 'Acme', primary: '#3c4876' })).toContain('fill="#3c4876"');
    expect(markSvg({ name: 'Acme', primary: '#3c4876', variant: 'dark' })).toContain(
      '<rect width="64" height="64" rx="14.08" fill="#ffffff"/>',
    );
  });

  it('never depends on a font: no <text> elements', () => {
    for (const svg of [logoSvg({ name: 'Acme', primary: '#3c4876' }), wordmarkSvg({ name: 'Acme' })]) {
      expect(svg).not.toContain('<text');
      expect(svg).toContain('role="img" aria-label="Acme"');
    }
  });
});
