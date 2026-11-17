import type { TaskChange } from './api';
import { MAX_ESTIMATE_HOURS, parseEstimate } from './estimate';
import { Task, WEEKS_IN_SEMESTER } from './types';

/** What the student typed on an assignment's details (US-44). */
export type TaskEditText = {
  title: string;
  dueWeek: string;
  hours: string;
};

export type CheckedTaskEdit = { ok: true; change: TaskChange } | { ok: false; problem: string };

/** The task as the boxes on its details start: its title, due week and hours. */
export function editTextFor(task: Task): TaskEditText {
  return {
    title: task.title,
    dueWeek: String(task.dueWeek),
    hours: task.estimatedHours === null ? '' : String(task.estimatedHours),
  };
}

/**
 * Checks what the student typed, with the same rules as the server
 * (PATCH /tasks/:id): a title that is not blank, a due week from 1 to 15,
 * and hours more than 0 and up to 100, or blank for "not known yet".
 * The change holds only the fields that differ from the task, so an empty
 * change means there is nothing to save.
 */
export function checkTaskEdit(task: Task, text: TaskEditText): CheckedTaskEdit {
  const title = text.title.trim();
  if (title === '') return { ok: false, problem: 'Give the assignment a title.' };

  const weekText = text.dueWeek.trim();
  const dueWeek = Number(weekText);
  if (!/^\d+$/.test(weekText) || dueWeek < 1 || dueWeek > WEEKS_IN_SEMESTER) {
    return { ok: false, problem: `The due week must be a whole number from 1 to ${WEEKS_IN_SEMESTER}.` };
  }

  const hours = parseEstimate(text.hours);
  if (!hours.ok) {
    return { ok: false, problem: `Enter hours more than 0 and up to ${MAX_ESTIMATE_HOURS}, or leave them blank.` };
  }

  const change: TaskChange = {};
  if (title !== task.title) change.title = title;
  if (dueWeek !== task.dueWeek) change.dueWeek = dueWeek;
  if (hours.hours !== task.estimatedHours) change.estimatedHours = hours.hours;
  return { ok: true, change };
}
