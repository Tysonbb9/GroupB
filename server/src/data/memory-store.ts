import { db, details, inputs } from './db';
import { DatabaseError } from './database-error';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask, SemesterUpdates } from './store';
import { nextTaskId } from './task-ids';
import type { CheckinAnswer, CoursePolicies, GradeWeight, Review, Task } from '../types';

/**
 * Refuses a course that does not exist, as the database's foreign keys do,
 * so code that only ran against this store still behaves with Supabase.
 */
function requireCourse(courseId: string, action: string): void {
  if (!db.courses.some((course) => course.id === courseId)) {
    throw new DatabaseError(`Failed to ${action}: course ${courseId} does not exist`);
  }
}

export class MemoryStore implements Store {
async getSemester() {
  return db;
}

async updateSemester(updates: SemesterUpdates) {
  if (updates.weeklyCapacity !== undefined) {
    db.weeklyCapacity = updates.weeklyCapacity;
  }
  return db;
}


async listCourses() {
  return db.courses;
}

async getCourse(id: string) {
  return db.courses.find((course) => course.id === id) ?? null;
}

async getTask(id: string) {
  return db.tasks.find((task) => task.id === id) ?? null;
}

async listTasks(filters: TaskFilters) {
  let tasks = db.tasks;

  if (filters.courseId !== undefined) {
    tasks = tasks.filter(
      (task) => task.courseId === filters.courseId
    );
  }

  if (filters.week !== undefined) {
    tasks = tasks.filter(
      (task) => task.dueWeek === filters.week
    );
  }

  if (filters.done !== undefined) {
    tasks = tasks.filter(
      (task) => task.done === filters.done
    );
  }

  return tasks;
}

async updateTask(id: string, updates: TaskUpdates) {
  const task = db.tasks.find((task) => task.id === id);

  if (!task) {
    return null;
  }

  if (updates.done !== undefined) {
    task.done = updates.done;
  }

  if (updates.estimatedHours !== undefined) {
    task.estimatedHours = updates.estimatedHours;
  }

  return task;
}

// The route checks every task before calling this, so nothing here can fail
// halfway and leave only some of them added.
async addTasks(newTasks: NewTask[]) {
  const taken = new Set(db.tasks.map((task) => task.id));

  return newTasks.map((newTask) => {
    const task: Task = {
      id: nextTaskId(newTask.courseId, taken),
      courseId: newTask.courseId,
      title: newTask.title,
      dueWeek: newTask.dueWeek,
      estimatedHours: newTask.estimatedHours,
      done: false,
    };
    taken.add(task.id);
    db.tasks.push(task);
    return task;
  });
}

async addReview(review: NewReview) {
  const newReview: Review = {
    id: `review-${inputs.reviews.length + 1}`,
    courseId: review.courseId,
    title: review.title,
    hours: review.hours,
    comment: review.comment,
  };

  inputs.reviews.push(newReview);

  return newReview;
}

async listReviews(courseId: string) {
  return inputs.reviews.filter(
    (review) => review.courseId === courseId
  );
}

// Course details (#144). Each method hands back copies, like rows read from
// a database, so a caller changing them cannot change what is saved.

async getSyllabus(courseId: string) {
  const syllabus = details.syllabi[courseId];
  return syllabus ? { ...syllabus } : null;
}

async saveSyllabus(courseId: string, text: string) {
  requireCourse(courseId, 'save syllabus');
  details.syllabi[courseId] = { courseId, text, readAt: new Date().toISOString() };
  return { ...details.syllabi[courseId] };
}

async listGradeWeights(courseId: string) {
  return structuredClone(details.gradeWeights[courseId] ?? []);
}

async replaceGradeWeights(courseId: string, weights: GradeWeight[]) {
  requireCourse(courseId, 'save grade weights');
  details.gradeWeights[courseId] = structuredClone(weights);
  return structuredClone(weights);
}

async getCoursePolicies(courseId: string) {
  const policies = details.policies[courseId];
  return policies ? structuredClone(policies) : null;
}

async saveCoursePolicies(courseId: string, policies: CoursePolicies) {
  requireCourse(courseId, 'save course policies');
  details.policies[courseId] = structuredClone(policies);
  return structuredClone(policies);
}

async getCheckin(userId: string, courseId: string) {
  const checkin = details.checkins[userId]?.[courseId];
  return checkin ? { ...checkin } : null;
}

async saveCheckin(userId: string, courseId: string, answer: CheckinAnswer) {
  requireCourse(courseId, 'save check-in');
  const checkin = { courseId, answer, answeredAt: new Date().toISOString() };
  details.checkins[userId] = { ...details.checkins[userId], [courseId]: checkin };
  return { ...checkin };
}

async listWeekHours(userId: string) {
  return Object.entries(details.weekHours[userId] ?? {})
    .map(([week, hours]) => ({ week: Number(week), hours }))
    .sort((a, b) => a.week - b.week);
}

async setWeekHours(userId: string, week: number, hours: number | null) {
  const weeks = { ...details.weekHours[userId] };
  if (hours === null) {
    delete weeks[week];
  } else {
    weeks[week] = hours;
  }
  details.weekHours[userId] = weeks;
  return this.listWeekHours(userId);
}

}
