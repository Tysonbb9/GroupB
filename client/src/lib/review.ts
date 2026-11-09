import { parseEstimate } from './estimate';
import { ScannedTask } from './inputs';
import { WEEKS_IN_SEMESTER } from './types';

/**
 * US-30: an assignment found in a syllabus, while the student is reviewing it.
 * Every field is the text in its box, so a half-typed value is never lost.
 */
export type Draft = { title: string; week: string; hours: string };

/** What a reviewed assignment looks like once every field is valid. */
export type Reviewed = { title: string; dueWeek: number; estimatedHours: number | null };

export type CheckedDraft = { ok: true; value: Reviewed } | { ok: false; error: string };

/** The boxes start filled in with what the scanner found. */
export function toDraft(task: ScannedTask): Draft {
  return {
    title: task.title,
    week: String(task.dueWeek),
    hours: task.estimatedHours === null ? '' : String(task.estimatedHours),
  };
}

/** Checks one reviewed assignment. The first problem found is the message. */
export function checkDraft(draft: Draft): CheckedDraft {
  const title = draft.title.trim();
  if (title === '') {
    return { ok: false, error: 'Give the assignment a title.' };
  }

  const week = draft.week.trim();
  const dueWeek = Number(week);
  if (!/^\d+$/.test(week) || dueWeek < 1 || dueWeek > WEEKS_IN_SEMESTER) {
    return { ok: false, error: `The week must be a whole number from 1 to ${WEEKS_IN_SEMESTER}.` };
  }

  const hours = parseEstimate(draft.hours);
  if (!hours.ok) {
    return { ok: false, error: 'Hours must be more than 0 and up to 100, or left blank.' };
  }

  return { ok: true, value: { title, dueWeek, estimatedHours: hours.hours } };
}