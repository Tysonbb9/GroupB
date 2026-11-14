/**
 * Rules that code checks, shared by the routes. The database checks each row
 * against the same limits (docs/DATABASE_DESIGN.md section 5), but a CHECK
 * constraint sees one row at a time, so anything that spans rows, like grade
 * weights adding up to 100%, is checked here. Each function returns the
 * message to show, or null when there is no problem.
 */
import type { CheckinAnswer, CoursePolicies, GradeWeight } from './types';
import { WEEKS_IN_SEMESTER } from './types';

/** Most hours a week a student can say they have. Same as the client's MAX_WEEKLY_HOURS. */
export const MAX_WEEKLY_CAPACITY = 80;

/** The check-in answers, in the order the screen offers them. */
export const CHECKIN_ANSWERS: readonly CheckinAnswer[] = ['on-schedule', 'changed', 'none-of-these'];

/** True for a finite number in (0, 100]: a percentage of a grade. */
function isPercent(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && value <= 100;
}

function isWholeNumberFrom(value: unknown, low: number, high: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high;
}

/**
 * A course's grade weights: each part named once, each worth more than 0%
 * and at most 100%, and all of them adding up to 100%. No weights at all is
 * fine, since a syllabus may not list any.
 */
export function gradeWeightsProblem(weights: GradeWeight[]): string | null {
  const seen = new Map<string, number>();
  for (const [index, weight] of weights.entries()) {
    const n = index + 1;
    const name = weight.name.trim();
    if (name === '') return `Weight ${n} needs a name.`;
    if (!isPercent(weight.percent)) return `Weight ${n} (${name}) must be more than 0% and at most 100%.`;
    const key = name.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) return `Weight ${n} (${name}) has the same name as weight ${first}.`;
    seen.set(key, n);
  }
  if (weights.length === 0) return null;
  // Rounded to hundredths, so 33.33 + 33.33 + 33.34 counts as 100.
  const total = Math.round(weights.reduce((sum, weight) => sum + weight.percent, 0) * 100) / 100;
  return total === 100 ? null : `The grade weights must add up to 100%. They add up to ${total}%.`;
}

/** One week's hours (#148): the same limits as the weekly hours (US-32). */
export function weekHoursProblem(week: number, hours: number): string | null {
  if (!isWholeNumberFrom(week, 1, WEEKS_IN_SEMESTER)) {
    return `week must be a whole number from 1 to ${WEEKS_IN_SEMESTER}`;
  }
  if (!isWholeNumberFrom(hours, 1, MAX_WEEKLY_CAPACITY)) {
    return `hours must be a whole number of hours from 1 to ${MAX_WEEKLY_CAPACITY}`;
  }
  return null;
}

/** A course's late rule and drop rule. Either can be missing (null). */
export function coursePoliciesProblem(policies: CoursePolicies): string | null {
  if (policies.late !== null) {
    if (!isPercent(policies.late.percentPerDay)) {
      return 'The late penalty must be more than 0% and at most 100% a day.';
    }
    if (!isWholeNumberFrom(policies.late.maxDays, 1, Number.MAX_SAFE_INTEGER)) {
      return 'Late work must be accepted for a whole number of days, at least 1.';
    }
  }
  if (policies.dropRule !== null && policies.dropRule.trim() === '') {
    return 'The drop rule is empty. Leave it out if the course has none.';
  }
  return null;
}
