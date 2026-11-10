import type { Course, Review, Semester, Task } from '../types';

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
}
