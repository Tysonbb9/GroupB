import { db, inputs } from './db';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask } from './store';
import { nextTaskId } from './task-ids';
import type { Review, Task } from '../types';

export class MemoryStore implements Store {
async getSemester() {
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

}
