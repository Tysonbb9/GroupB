import type { Course, Task } from '../types';
import { WEEKS_IN_SEMESTER } from '../rules';
import type { CalendarEvent } from './ics';

/**
 * US-49 (#165): turning calendar events into tasks the student can review.
 * Nothing here saves anything; the student taps Add (routes.ts).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Monday (00:00 UTC) of the week a moment falls in. */
function mondayOf(moment: Date): Date {
  const day = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + 6) % 7; // Sunday is 0 in JavaScript
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

/**
 * The Monday week 1 began. The semester has no start date, only the week it
 * is now, so week 1 is counted back from this week: the same weeks the app
 * already shows.
 */
export function semesterStart(currentWeek: number, today: Date): Date {
  return new Date(mondayOf(today).getTime() - (currentWeek - 1) * 7 * DAY_MS);
}

/** The semester week a moment falls in, or null when it is outside weeks 1 to 15. */
export function weekOf(moment: Date, start: Date): number | null {
  const week = Math.floor((moment.getTime() - start.getTime()) / (7 * DAY_MS)) + 1;
  return week >= 1 && week <= WEEKS_IN_SEMESTER ? week : null;
}

/** "CS 262", "cs262" and "CS-262" all read as CS262. */
function compact(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The student's course this event belongs to, or null when it names none or
 * more than one. Moodle names the course in CATEGORIES (its short name, such
 * as "CS262-A FA26"); the title is a fallback. A code only matches whole:
 * "CS 26" does not match "CS262".
 */
export function matchCourse(event: CalendarEvent, courses: Pick<Course, 'id' | 'code'>[]): string | null {
  for (const source of [event.categories.join(' '), event.title]) {
    const text = compact(source);
    const found = courses.filter((course) => {
      const code = compact(course.code);
      if (code === '') return false;
      // The character after the code must not be a digit, so CS26 does not match CS262.
      return new RegExp(`${code}(?![0-9])`).test(text);
    });
    if (found.length === 1) return found[0].id;
    if (found.length > 1) return null;
  }
  return null;
}

/** Moodle titles its due dates "Lab 3 is due" or "Lab 3 due"; the task is "Lab 3". */
export function taskTitle(eventTitle: string): string {
  const trimmed = eventTitle.replace(/\s+(is\s+)?due\.?$/i, '').trim();
  return trimmed === '' ? eventTitle.trim() : trimmed;
}

/** One event, ready for the student to check: placed in a course when it could be matched. */
export type Proposal = {
  eventId: string;
  title: string;
  dueWeek: number;
  courseId: string | null;
  /** True when the same course already has a task with this title in this week (from the syllabus). */
  alreadyInSemester: boolean;
};

export type Proposals = {
  proposals: Proposal[];
  /** Events skipped because they were added before. */
  alreadyAdded: number;
  /** Events skipped because they fall outside weeks 1 to 15. */
  outsideSemester: number;
};

/**
 * The events to show for review: not added before, inside the semester,
 * soonest first. Events that match no course stay, for the student to place.
 */
export function buildProposals(
  events: CalendarEvent[],
  courses: Pick<Course, 'id' | 'code'>[],
  tasks: Pick<Task, 'courseId' | 'title' | 'dueWeek'>[],
  importedIds: Set<string>,
  start: Date
): Proposals {
  let alreadyAdded = 0;
  let outsideSemester = 0;
  const proposals: Proposal[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (seen.has(event.uid)) continue; // the same event twice in one file
    seen.add(event.uid);
    if (importedIds.has(event.uid)) {
      alreadyAdded += 1;
      continue;
    }
    const dueWeek = weekOf(event.start, start);
    if (dueWeek === null) {
      outsideSemester += 1;
      continue;
    }
    const courseId = matchCourse(event, courses);
    const title = taskTitle(event.title);
    const alreadyInSemester =
      courseId !== null &&
      tasks.some(
        (task) => task.courseId === courseId && task.dueWeek === dueWeek && task.title.trim().toLowerCase() === title.toLowerCase()
      );
    proposals.push({ eventId: event.uid, title, dueWeek, courseId, alreadyInSemester });
  }

  proposals.sort((a, b) => a.dueWeek - b.dueWeek || a.title.localeCompare(b.title));
  return { proposals, alreadyAdded, outsideSemester };
}
