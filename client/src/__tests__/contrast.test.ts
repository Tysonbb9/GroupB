import { theme } from '../theme';

/**
 * The colours used for text have to be readable on both backgrounds the app
 * draws on. WCAG AA asks for a contrast ratio of at least 4.5 to 1 for normal
 * text (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
 * The review of #129 measured the old faint grey at 2.6 to 1, below that.
 */

/** A colour's relative luminance, as WCAG defines it, from "#RRGGBB". */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How far apart two colours are, from 1 (the same) to 21 (black on white). */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

type TextColour = 'ink' | 'muted' | 'faint' | 'accent';
type Background = 'bg' | 'surface';

const TEXT_COLOURS: TextColour[] = ['ink', 'muted', 'faint', 'accent'];
const BACKGROUNDS: Background[] = ['bg', 'surface'];
const PAIRS = TEXT_COLOURS.flatMap((text) =>
  BACKGROUNDS.map((ground): [TextColour, Background] => [text, ground])
);

describe('Text colours are readable (WCAG AA, 4.5 to 1)', () => {
  it.each(PAIRS)('%s text on %s', (text, ground) => {
    expect(contrast(theme[text], theme[ground])).toBeGreaterThanOrEqual(4.5);
  });

  it('measures the way WCAG does', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrast('#93A3A8', '#FFFFFF')).toBeCloseTo(2.61, 2);
  });
});
