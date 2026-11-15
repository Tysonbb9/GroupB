import type {
  CheckinAnswer,
  Course,
  CourseCheckin,
  CoursePolicies,
  GradeWeight,
  Review,
  Semester,
  Syllabus,
  Task,
  WeekHours,
} from '../types';

export type TaskFilters = {
  courseId?: string;
  week?: number;
  done?: boolean;
};

export type TaskUpdates = {
  done?: boolean;
  estimatedHours?: number | null;
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
  getSemester(): Promise<Semester>;
  /** Changes the semester's settings and returns the semester with them. */
  updateSemester(updates: SemesterUpdates): Promise<Semester>;

  listCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | null>;

  listTasks(filters: TaskFilters): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  updateTask(
    id: string,
    updates: TaskUpdates
  ): Promise<Task | null>;
  /** Adds every task or none (US-30), and returns them with their new ids. */
  addTasks(tasks: NewTask[]): Promise<Task[]>;

  addReview(review: NewReview): Promise<Review>;
  listReviews(courseId: string): Promise<Review[]>;

  /*
   * Course details for the AI screens (#144). The routes check the values
   * (src/rules.ts) and that the course exists before saving. Saving for a
   * course that does not exist is refused with a DatabaseError, as the
   * database's foreign key refuses it.
   */

  /** The text read from a course's syllabus, or null if none was saved. */
  getSyllabus(courseId: string): Promise<Syllabus | null>;
  /** Keeps one syllabus per course: saving again replaces it. */
  saveSyllabus(courseId: string, text: string): Promise<Syllabus>;

  /** A course's grade weights in the syllabus's order, or [] if none were saved. */
  listGradeWeights(courseId: string): Promise<GradeWeight[]>;
  /** Replaces all of a course's weights at once, all or nothing. [] clears them. */
  replaceGradeWeights(courseId: string, weights: GradeWeight[]): Promise<GradeWeight[]>;

  /** A course's late and drop rules, or null if they were never saved. */
  getCoursePolicies(courseId: string): Promise<CoursePolicies | null>;
  saveCoursePolicies(courseId: string, policies: CoursePolicies): Promise<CoursePolicies>;

  /** A student's latest check-in answer for a course, or null if they never answered. */
  getCheckin(userId: string, courseId: string): Promise<CourseCheckin | null>;
  /** Records the answer as the latest, timed now. */
  saveCheckin(userId: string, courseId: string, answer: CheckinAnswer): Promise<CourseCheckin>;

  /** The weeks a student gave their own hours (#148), by week. */
  listWeekHours(userId: string): Promise<WeekHours[]>;
  /** Sets one week's hours, or clears them with null, and returns every set week. */
  setWeekHours(userId: string, week: number, hours: number | null): Promise<WeekHours[]>;
}
