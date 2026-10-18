import { avatarPalette, darkColors, lightColors, type ThemeColors } from '@/theme/tokens';

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXT_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['primary', 'surface'],
  ['primary', 'background'],
  ['onPrimary', 'primary'],
  ['onDanger', 'danger'],
  ['accentText', 'background'],
  ['success', 'successBg'],
  ['warning', 'warningBg'],
  ['danger', 'dangerBg'],
  ['info', 'infoBg'],
  ['neutral', 'neutralBg'],
  ['primary', 'primarySoft'],
  ['danger', 'surface'],
  ['warning', 'surface'],
  ['tabInactive', 'tabBar'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme contrast (WCAG AA 4.5:1 for text)', (_name, colors) => {
  it.each(TEXT_PAIRS)('%s on %s', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

it('white initials are readable on every avatar colour', () => {
  for (const c of avatarPalette) expect(contrast('#FFFFFF', c)).toBeGreaterThanOrEqual(4.5);
});
