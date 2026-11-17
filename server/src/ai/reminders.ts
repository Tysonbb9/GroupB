import type { Course, Semester, Task } from '../types';

/**
 * Screen 3 of the AI screens (#156, docs/ui/ai-screens.html): a reminder,
 * and the limits around it. The limits are code, not the model:
 *
 *  - at most MAX_REMINDERS_PER_DAY a day, and
 *  - never twice about the same assignment.
 *
 * "Never during class" waits for a class timetable, which the app does not
 * have yet. This first version words the reminder with a fixed sentence, so
 * no model call is needed; the route only shows reminders when a model is
 * set up, so with no key the app works as it did.
 */

export const MAX_REMINDERS_PER_DAY = 2;

/** One reminder that was shown: which assignment, and when. */
export type ShownReminder = { taskId: string; shownAt: Date };

/**
 * The record of what was shown to each student, which the limits are
 * checked against. It lives in memory for now, as the card asks, so a
 * server restart forgets it; moving it to the database can follow.
 */
export class ReminderLog {
  private readonly shown = new Map<string, ShownReminder[]>();

  list(userId: string): ShownReminder[] {
    return [...(this.shown.get(userId) ?? [])];
  }

  record(userId: string, taskId: string, shownAt: Date): void {
    this.shown.set(userId, [...this.list(userId), { taskId, shownAt }]);
  }
}

/** The calendar day of a moment, as YYYY-MM-DD in UTC, so a test's clock gives the same day anywhere. */
function dayOf(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/** How many reminders were shown on the same day as `now`. */
export function remindersOn(shown: ShownReminder[], now: Date): number {
  const today = dayOf(now);
  return shown.filter((s) => dayOf(s.shownAt) === today).length;
}

/**
 * The assignment to remind about, or null when the limits say no or there
 * is nothing worth a reminder. A candidate is open (not done), has hours,
 * is due this week or next, and has never been reminded about. The soonest
 * due comes first, then the one with the most hours, then by id, so the
 * choice never depends on the order tasks happen to be stored in.
 */
export function pickReminder(semester: Semester, shown: ShownReminder[], now: Date): Task | null {
  if (remindersOn(shown, now) >= MAX_REMINDERS_PER_DAY) return null;

  const reminded = new Set(shown.map((s) => s.taskId));
  const candidates = semester.tasks.filter(
    (task) =>
      !task.done &&
      task.estimatedHours !== null &&
      task.dueWeek >= semester.currentWeek &&
      task.dueWeek <= semester.currentWeek + 1 &&
      !reminded.has(task.id)
  );

  candidates.sort(
    (a, b) =>
      a.dueWeek - b.dueWeek ||
      (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0) ||
      a.id.localeCompare(b.id)
  );
  return candidates[0] ?? null;
}

/** Hours as words: "1 hour", "6 hours", "2.5 hours". */
function hoursText(hours: number): string {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * The reminder's one line, as in the mockup: one action and one number.
 * Work due this week is to finish; work due next week is to start.
 */
export function reminderText(task: Task, currentWeek: number): string {
  const hours = hoursText(task.estimatedHours ?? 0);
  return task.dueWeek === currentWeek
    ? `Finish it this week: ${hours}, due week ${task.dueWeek}.`
    : `Start it this week: ${hours}, due week ${task.dueWeek}.`;
}

/** What the phone shows: the course and assignment, the line, and the day's count ("1 of 2 today"). */
export type Reminder = {
  taskId: string;
  courseId: string;
  code: string;
  title: string;
  text: string;
  countToday: number;
  maxPerDay: number;
};

/**
 * Picks a reminder, records it as shown, and returns what the phone shows,
 * or null when the limits say no or nothing qualifies. Recording happens
 * here, in the same step, so the same reminder cannot be handed out twice.
 */
export function nextReminder(
  userId: string,
  semester: Semester,
  log: ReminderLog,
  now: Date
): Reminder | null {
  const shown = log.list(userId);
  const task = pickReminder(semester, shown, now);
  if (task === null) return null;

  const course: Course | undefined = semester.courses.find((c) => c.id === task.courseId);
  log.record(userId, task.id, now);
  return {
    taskId: task.id,
    courseId: task.courseId,
    code: course?.code ?? '',
    title: task.title,
    text: reminderText(task, semester.currentWeek),
    countToday: remindersOn(shown, now) + 1,
    maxPerDay: MAX_REMINDERS_PER_DAY,
  };
}
