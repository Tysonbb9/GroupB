/** One place for colours and spacing so the screens stay readable. */
export const theme = {
  bg: '#F3F6F6',
  surface: '#FFFFFF',
  ink: '#16202A',
  muted: '#5A6A72',
  faint: '#93A3A8',
  rule: '#DCE4E4',
  accent: '#1F5C6B',
  accentSoft: '#E2EDEF',

  /** Load relative to capacity. Also the legend on the semester screen. */
  calm: '#3F7F6E',
  moderate: '#B8912A',
  heavy: '#A93F30',

  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: 6,
} as const;

/**
 * Which band a week's projected hours falls into.
 * Over capacity is heavy; within two-thirds of capacity is calm.
 */
export function loadColor(hours: number, capacity: number): string {
  if (hours > capacity) return theme.heavy;
  if (hours > capacity * 0.66) return theme.moderate;
  return theme.calm;
}
