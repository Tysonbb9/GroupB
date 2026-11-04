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

export type NewReview = {
  courseId: string;
  title: string;
  hours: number;
  comment: string;
};

export interface Store {
  getSemester(): Promise<Semester>;

  listCourses(): Promise<Course[]>;
  getCourse(id: string): Promise<Course | null>;

  listTasks(filters: TaskFilters): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  updateTask(
    id: string,
    updates: TaskUpdates
  ): Promise<Task | null>;

  addReview(review: NewReview): Promise<Review>;
  listReviews(courseId: string): Promise<Review[]>;
}
