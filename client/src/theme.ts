import { Category } from './lib/categories';
import { LoadBand, loadBand } from './lib/workload';

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

const BAND_COLORS: Record<LoadBand, string> = {
  calm: theme.calm,
  moderate: theme.moderate,
  heavy: theme.heavy,
};

/** The colour of the load band a week's projected hours falls into. */
export function loadColor(hours: number, capacity: number): string {
  return BAND_COLORS[loadBand(hours, capacity)];
}

const CATEGORY_COLORS: Record<Category, string> = {
  exam: '#7B3F6E',
  project: '#35507F',
  problemSet: '#2E6B5A',
  reading: '#6E5A2E',
  writing: '#8A4A35',
  homework: '#46607A',
};

/** The colour of a category, or a neutral one when the category is unknown. */
export function categoryColor(category: Category | undefined): string {
  return category === undefined ? theme.faint : CATEGORY_COLORS[category];
}
