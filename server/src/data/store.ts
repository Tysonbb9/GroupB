import type { NewCourse, CatalogCourse, CourseCreation } from './course-catalog';
import type {
  CheckinAnswer,
  Course,
  CourseCheckin,
  Review,
  Semester,
  Task,
  WeekHours,
  CalendarLink,
  CalendarImport,
} from '../types';

export type TaskFilters = {
  courseId?: string;
  week?: number;
  done?: boolean;
};

export type TaskUpdates = {
  done?: boolean;
  estimatedHours?: number | null;
  dueWeek?: number;
};

export type SemesterUpdates = {
  /** Hours the student has each week (US-32). */
  weeklyCapacity?: number;
};

export type NewTask = {
  courseId: string;
  title: string;
  dueWeek: number;
  estimatedHours: number | null;
};

export type NewReview = {
  courseId: string;
  title: string;
  hours: number;
  comment: string;
};

export interface Store {
  getSemester(userId: string): Promise<Semester>;
  /** Copies the sample only into an empty account; null means it already has data. */
  loadSample(userId: string): Promise<Semester | null>;
  /** Changes the student's settings and returns the semester with them. */
  updateSemester(userId: string, updates: SemesterUpdates): Promise<Semester>;

  searchCatalog(userId: string, query: string): Promise<CatalogCourse[]>;
  /** Joining twice changes nothing; an unknown catalog id returns null. */
  enroll(userId: string, courseId: string): Promise<Course | null>;
  /** A duplicate returns the existing course without enrolling the caller. */
  createCourse(userId: string, course: NewCourse): Promise<CourseCreation>;
  listCourses(userId: string): Promise<Course[]>;
  getCourse(userId: string, id: string): Promise<Course | null>;

  listTasks(userId: string, filters: TaskFilters): Promise<Task[]>;
  getTask(userId: string, id: string): Promise<Task | null>;
  updateTask(
    userId: string,
    id: string,
    updates: TaskUpdates
  ): Promise<Task | null>;
  /** Deletes one of the student's tasks (#166). True when there was one to delete. */
  deleteTask(userId: string, id: string): Promise<boolean>;
  /** Adds every task or none (US-30), and returns them with their new ids. */
  addTasks(userId: string, tasks: NewTask[]): Promise<Task[]>;

  addReview(review: NewReview): Promise<Review>;
  listReviews(courseId: string): Promise<Review[]>;

  /*
   * Course details for the AI screens (#144). The routes check the values
   * (src/rules.ts) and that the course exists before saving. Saving for a
   * course that does not exist is refused with a DatabaseError, as the
   * database's foreign key refuses it.
   */

  /** A student's latest check-in answer for a course, or null if they never answered. */
  getCheckin(userId: string, courseId: string): Promise<CourseCheckin | null>;
  /** Records the answer as the latest, timed now. */
  saveCheckin(userId: string, courseId: string, answer: CheckinAnswer): Promise<CourseCheckin>;

  /** The weeks a student gave their own hours (#148), by week. */
  listWeekHours(userId: string): Promise<WeekHours[]>;
  /** Sets one week's hours, or clears them with null, and returns every set week. */
  setWeekHours(userId: string, week: number, hours: number | null): Promise<WeekHours[]>;

  /** A student's Moodle calendar link (#164), or null if none was saved. Server use only. */
  getCalendarLink(userId: string): Promise<CalendarLink | null>;
  /** Saves the link, replacing any earlier one, timed now. */
  saveCalendarLink(userId: string, url: string): Promise<CalendarLink>;

  /** The Moodle events a student added as tasks (#165), each with its task and week. */
  listCalendarImports(userId: string): Promise<CalendarImport[]>;
  /** Records events just added as tasks. An event recorded before is replaced. */
  recordCalendarImports(userId: string, imports: CalendarImport[]): Promise<void>;
  /** Forgets these events (#166), once a removed event's change is settled. */
  deleteCalendarImports(userId: string, eventIds: string[]): Promise<void>;
}
