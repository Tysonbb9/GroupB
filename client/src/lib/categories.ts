/**
 * The fixed set of assignment categories. A category sets the colour and the
 * two-letter tile an assignment carries wherever it appears, so a problem set
 * does not look like an essay from across the room.
 *
 * The set is closed on purpose: if categories were open-ended, colour would
 * stop meaning anything.
 */
export type Category =
  | 'exam'
  | 'project'
  | 'problemSet'
  | 'reading'
  | 'writing'
  | 'homework';

export const CATEGORY_INFO: Record<Category, { label: string; tile: string }> = {
  exam: { label: 'Exam', tile: 'EX' },
  project: { label: 'Project', tile: 'PJ' },
  problemSet: { label: 'Problem set', tile: 'PS' },
  reading: { label: 'Reading', tile: 'RD' },
  writing: { label: 'Writing', tile: 'WR' },
  homework: { label: 'Lab / homework', tile: 'HW' },
};
