import type { AiAssignment } from './api';
import { parseEstimate } from './estimate';
import { ScannedTask } from './inputs';
import { Course, Task, WEEKS_IN_SEMESTER } from './types';

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

/**
 * The boxes for an assignment the AI read. A week or hours the AI could not
 * find start empty, never guessed. A blank week is a problem the student has
 * to fill in (checkDraft refuses it), and blank hours are allowed.
 */
export function fromReading(assignment: AiAssignment): Draft {
  return {
    title: assignment.title,
    week: assignment.dueWeek === null ? '' : String(assignment.dueWeek),
    hours: assignment.estimatedHours === null ? '' : String(assignment.estimatedHours),
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

/** Warn only when the text clearly names one other course and not this one. */
export function courseMentioned(
  text: string,
  courses: Pick<Course, 'id' | 'code'>[],
  chosenId: string
): string | null {
  const mentioned = courses.filter((course) => {
    const parts = course.code.trim().split(/[\s-]+|(?<=[A-Za-z])(?=\d)/);
    const code = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]*');
    return code !== '' && new RegExp(`(^|[^A-Za-z0-9])${code}(?![A-Za-z0-9])`, 'i').test(text);
  });
  if (mentioned.some((course) => course.id === chosenId)) return null;
  return mentioned.length === 1 ? mentioned[0].code : null;
}

/** A review hint only: adding a matching draft is still the student's choice. */
export function isDuplicate(
  draft: Draft,
  tasks: Pick<Task, 'courseId' | 'title' | 'dueWeek'>[],
  courseId: string
): boolean {
  const week = draft.week.trim();
  if (!/^\d+$/.test(week)) return false;
  return tasks.some((task) =>
    task.courseId === courseId && task.dueWeek === Number(week) &&
    task.title.trim().toLowerCase() === draft.title.trim().toLowerCase()
  );
}
