/**
 * The hours a student can say they have each week (US-32). The server's
 * PATCH /semester checks the same range, so a value the screen accepts is
 * always one the server keeps.
 */
export const MIN_WEEKLY_HOURS = 1;
export const MAX_WEEKLY_HOURS = 80;

/**
 * What the student typed as their hours a week, or null when it is not a
 * whole number from 1 to 80. Whole hours only: nobody plans a week to the
 * half hour, and a forecast should not pretend to be that precise.
 */
export function parseWeeklyHours(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const hours = Number(trimmed);
  return hours >= MIN_WEEKLY_HOURS && hours <= MAX_WEEKLY_HOURS ? hours : null;
}
