// server/src/data/db.ts
import { semester as seed } from './semester';
import type { CourseCheckin, CoursePolicies, GradeWeight, Inputs, Semester, Syllabus } from '../types';

/**
 * The live in-memory "database". It starts as a deep copy of the seed data,
 * so PATCH requests never modify the seed itself. Tests call resetDb() so
 * each one starts from the same known state.
 */
export let db: Semester = structuredClone(seed);

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
};

const noDetails = (): CourseDetails => ({ syllabi: {}, gradeWeights: {}, policies: {}, checkins: {}, weekHours: {} });

/** Starts empty, like the database's new tables. */
export let details: CourseDetails = noDetails();

export function resetDb(): void {
  db = structuredClone(seed);
  inputs = { reviews: [] };
  details = noDetails();
}