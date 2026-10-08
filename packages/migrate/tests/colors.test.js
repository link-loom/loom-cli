import { colorsToTokens, withLegacyColors } from '../src/colors.js';

describe('colours to tokens', () => {
  it('reads every colour literal from the theme, alone or inside a string', () => {
    const source = [
      'import { Box } from "@mui/material";',
      '',
      'export default function Swatch() {',
      '  const border = `1px solid #dddddd`;',
      '  return <Box sx={{ color: "#838790", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)" }} href="/items#add-gemstone" />;',
      '}',
      '',
    ].join('\n');
    const { source: rewritten, colors } = colorsToTokens(source, 'Swatch.jsx');

    expect(rewritten).toContain('import { LEGACY_COLORS } from "@constants/theme";');
    expect(rewritten).toContain('const border = `1px solid ${LEGACY_COLORS.hexdddddd}`;');
    expect(rewritten).toContain('color: LEGACY_COLORS.hex838790');
    expect(rewritten).toContain('boxShadow: `0 2px 4px ${LEGACY_COLORS.rgba0000_2}`');
    expect(rewritten).toContain('href="/items#add-gemstone"');
    expect(colors).toEqual({ hexdddddd: '#dddddd', hex838790: '#838790', rgba0000_2: 'rgba(0, 0, 0, 0.2)' });
    expect(withLegacyColors('export const THEME_COLORS = {};\n', colors)).toContain('  hex838790: "#838790",');
  });
});
