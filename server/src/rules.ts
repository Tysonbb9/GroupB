/**
 * Rules that code checks, shared by the routes. The database checks each row
 * against the same limits (docs/DATABASE_DESIGN.md section 5), so a value
 * the API accepts can always be saved.
 */
/** Most hours a week a student can say they have. Same as the client's MAX_WEEKLY_HOURS. */
export const MAX_WEEKLY_CAPACITY = 80;

/** Weeks in a semester. Fixed for now, like the phone's WEEKS_IN_SEMESTER. */
export const WEEKS_IN_SEMESTER = 15;

/**
 * The most hours a task estimate or a review can have. Same limit as the
 * client's MAX_ESTIMATE_HOURS and the database's CHECK, so a value the API
 * accepts can always be saved.
 */
export const MAX_HOURS = 100;

/** True when value is a number more than 0 and up to MAX_HOURS. */
export function isValidHours(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && value <= MAX_HOURS;
}
