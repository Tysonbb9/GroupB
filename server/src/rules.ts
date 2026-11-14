/**
 * Rules that code checks, shared by the routes. The database checks each row
 * against the same limits (docs/DATABASE_DESIGN.md section 5), but a CHECK
 * constraint sees one row at a time, so a rule that spans rows, like grade
 * weights adding up to 100%, is checked here. It returns the message to
 * show, or null when there is no problem.
 */
import type { GradeWeight } from './types';

/** Most hours a week a student can say they have. Same as the client's MAX_WEEKLY_HOURS. */
export const MAX_WEEKLY_CAPACITY = 80;

/** True for a finite number in (0, 100]: a percentage of a grade. */
function isPercent(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && value <= 100;
}

/**
 * A course's grade weights: each part named, each worth more than 0% and at
 * most 100%, and all of them adding up to 100%. No weights at all is fine,
 * since a syllabus may not list any.
 */
export function gradeWeightsProblem(weights: GradeWeight[]): string | null {
  for (const [index, weight] of weights.entries()) {
    const n = index + 1;
    const name = weight.name.trim();
    if (name === '') return `Weight ${n} needs a name.`;
    if (!isPercent(weight.percent)) return `Weight ${n} (${name}) must be more than 0% and at most 100%.`;
  }
  if (weights.length === 0) return null;
  // Rounded to hundredths, so 33.33 + 33.33 + 33.34 counts as 100.
  const total = Math.round(weights.reduce((sum, weight) => sum + weight.percent, 0) * 100) / 100;
  return total === 100 ? null : `The grade weights must add up to 100%. They add up to ${total}%.`;
}
