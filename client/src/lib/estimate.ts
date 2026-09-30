/** The largest estimate we will accept for one assignment, in hours. */
export const MAX_ESTIMATE_HOURS = 100;

/**
 * What the student typed into an estimate field, as a value we can store.
 *
 *  - blank means "I do not know yet", which clears the estimate (`null`)
 *  - a positive number up to 100 is the estimate
 *  - anything else is invalid, so nothing is saved
 */
export type ParsedEstimate =
  | { ok: true; hours: number | null }
  | { ok: false };

export function parseEstimate(text: string): ParsedEstimate {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, hours: null };

  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false };

  const hours = Number(trimmed);
  if (hours <= 0 || hours > MAX_ESTIMATE_HOURS) return { ok: false };

  return { ok: true, hours };
}
