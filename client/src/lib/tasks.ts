import { Course, Semester, Task } from './types';
import { plannedStart } from './workload';

/**
 * Order the outstanding work by how much it deserves attention right now.
 *
 * Overdue first, then whatever is due soonest, then the bigger job of the
 * two — a four-hour project and a ten-minute reading due the same day are
 * not equally urgent.
 */
export function rankThisWeek(semester: Semester): Task[] {
  const outstanding = semester.tasks.filter((t) => !t.done);

  return [...outstanding].sort((a, b) => {
    const aLate = a.dueWeek < semester.currentWeek;
    const bLate = b.dueWeek < semester.currentWeek;
    if (aLate !== bLate) return aLate ? -1 : 1;

    if (a.dueWeek !== b.dueWeek) return a.dueWeek - b.dueWeek;

    const aHours = a.estimatedHours ?? 0;
    const bHours = b.estimatedHours ?? 0;
    if (aHours !== bHours) return bHours - aHours;

    return a.title.localeCompare(b.title);
  });
}

/**
 * How many more classes the student can miss in a course.
 * null means the syllabus did not set a policy, which is not the same
 * as a policy of zero.
 */
export function absencesRemaining(course: Course): number | null {
  if (course.attendance === null) return null;
  return Math.max(0, course.attendance.allowed - course.attendance.used);
}

export type TaskGroupKey = 'overdue' | 'thisWeek' | 'nextWeek';

export type TaskGroup = { key: TaskGroupKey; label: string; tasks: Task[] };

/**
 * The outstanding work for the This week screen, grouped by urgency: overdue,
 * due this week, due next week. Within a group the order is `rankThisWeek`'s.
 * Empty groups are left out, and work due later is not on this screen.
 */
export function groupThisWeek(semester: Semester): TaskGroup[] {
  const ranked = rankThisWeek(semester);
  const now = semester.currentWeek;

  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Overdue', tasks: ranked.filter((t) => t.dueWeek < now) },
    { key: 'thisWeek', label: 'Due this week', tasks: ranked.filter((t) => t.dueWeek === now) },
    { key: 'nextWeek', label: 'Next week', tasks: ranked.filter((t) => t.dueWeek === now + 1) },
  ];

  return groups.filter((group) => group.tasks.length > 0);
}

/**
 * The next assignments to be aware of, ordered by when the work needs to
 * start rather than by due date alone: a big assignment due later can need
 * starting sooner than a small one due soon. Overdue work is left to the This
 * week screen.
 */
export function comingUp(semester: Semester, limit: number): Task[] {
  const upcoming = semester.tasks.filter(
    (t) => !t.done && t.dueWeek >= semester.currentWeek
  );
  const start = (t: Task) => plannedStart(t, semester.weeklyCapacity);

  return upcoming
    .sort(
      (a, b) =>
        start(a) - start(b) ||
        a.dueWeek - b.dueWeek ||
        (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0) ||
        a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}

export type AttendanceTone = 'calm' | 'moderate' | 'heavy' | 'none';

/**
 * How a course's attendance reads on its chip. "No policy" is deliberately
 * different from "0 left": one means nothing is set, the other means the
 * student cannot miss another class.
 */
export function attendanceStatus(course: Course): { label: string; tone: AttendanceTone } {
  const left = absencesRemaining(course);
  if (left === null) return { label: 'no policy', tone: 'none' };
  if (left === 0) return { label: '0 left', tone: 'heavy' };

  const label = `${left} absence${left === 1 ? '' : 's'}`;
  return { label, tone: left <= 2 ? 'moderate' : 'calm' };
}

/**
 * Whether to flag a task "start now": it is not yet due, but the week to
 * begin it (see `plannedStart`) has arrived. Work already due this week or overdue is never
 * flagged; there the flag would be true of everything and stop meaning
 * anything.
 */
export function startsNow(task: Task, currentWeek: number, weeklyCapacity: number): boolean {
  return task.dueWeek > currentWeek && plannedStart(task, weeklyCapacity) <= currentWeek;
}
