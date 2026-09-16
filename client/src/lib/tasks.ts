import { Course, Semester, Task } from './types';

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
