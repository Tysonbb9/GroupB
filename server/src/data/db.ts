// server/src/data/db.ts
import { semester as seed } from './semester';
import type { CalendarLink, CourseCheckin, CoursePolicies, GradeWeight, Inputs, Semester, Syllabus, Task } from '../types';

/**
 * The catalog and calendar are shared. Enrollments, tasks and capacity belong
 * to a student, so signing up does not give them the sample automatically.
 * Tests call resetDb() to restore the catalog and clear student data.
 */
type MemoryDatabase = Omit<Semester, 'tasks'> & {
  tasks: (Task & { userId: string })[];
  enrollments: { userId: string; courseId: string }[];
  settings: Map<string, number>;
};
const emptyDb = (): MemoryDatabase => ({ ...structuredClone(seed), tasks: [], enrollments: [], settings: new Map() });
export let db = emptyDb();

/** US-22: what the student has handed us. Starts empty. */
export let inputs: Inputs = { reviews: [] };

/** #144: the course details the AI screens save, and each student's own answers and hours. */
export type CourseDetails = {
  /** By course id. */
  syllabi: Record<string, Syllabus>;
  gradeWeights: Record<string, GradeWeight[]>;
  policies: Record<string, CoursePolicies>;
  /** By user id, then course id. */
  checkins: Record<string, Record<string, CourseCheckin>>;
  /** By user id, then week. */
  weekHours: Record<string, Record<number, number>>;
  /** #164: each student's Moodle calendar link, by user id. */
  calendarLinks: Record<string, CalendarLink>;
};

const noDetails = (): CourseDetails => ({
  syllabi: {},
  gradeWeights: {},
  policies: {},
  checkins: {},
  weekHours: {},
  calendarLinks: {},
});

/** Starts empty, like the database's new tables. */
export let details: CourseDetails = noDetails();

export function resetDb(): void {
  db = emptyDb();
  inputs = { reviews: [] };
  details = noDetails();
}