import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask } from './store';
import { DatabaseError } from './database-error';
import { nextTaskId } from './task-ids';

export class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.client = createClient(url, secretKey);
  }

private async getSemesterRow() {
  const { data, error } = await this.client
    .from('semester')
    .select('label, current_week, weekly_capacity')
    .single();
    if (error) {
        throw new DatabaseError(`Failed to load semester: ${error.message}`);
}


  return data;
}

async listCourses() {
  const { data, error } = await this.client
    .from('courses')
    .select('id, code, name, attendance_allowed, attendance_used')
    .order('id');

  if (error) {
    throw new DatabaseError(`Failed to load courses: ${error.message}`);
  }

  return data.map((course) => ({
    id: course.id,
    code: course.code,
    name: course.name,
    attendance:
      course.attendance_allowed === null
        ? null
        : {
            allowed: course.attendance_allowed,
            used: course.attendance_used,
          },
  }));
}

async getCourse(id: string) {
  const { data, error } = await this.client
    .from('courses')
    .select('id, code, name, attendance_allowed, attendance_used')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load course: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    attendance:
      data.attendance_allowed === null
        ? null
        : {
            allowed: data.attendance_allowed,
            used: data.attendance_used,
          },
  };
}

async getTask(id: string) {
  const { data, error } = await this.client
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load task: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    category: data.category ?? undefined,
    dueWeek: data.due_week,
    estimatedHours: data.estimated_hours,
    spreadWeeks: data.spread_weeks,
    done: data.done,
  };
}

async listTasks(filters: TaskFilters) {
  let query = this.client
    .from('tasks')
    .select('*');

  if (filters.courseId !== undefined) {
    query = query.eq('course_id', filters.courseId);
  }

  if (filters.week !== undefined) {
    query = query.eq('due_week', filters.week);
  }

  if (filters.done !== undefined) {
    query = query.eq('done', filters.done);
  }

  const { data, error } = await query.order('id');

  if (error) {
    throw new DatabaseError(`Failed to load tasks: ${error.message}`);
  }

  return data.map((task) => ({
    id: task.id,
    courseId: task.course_id,
    title: task.title,
    category: task.category ?? undefined,
    dueWeek: task.due_week,
    estimatedHours: task.estimated_hours,
    spreadWeeks: task.spread_weeks,
    done: task.done,
  }));
}

async updateTask(id: string, updates: TaskUpdates) {
  const changes: Record<string, boolean | number | null> = {};

  if (updates.done !== undefined) {
    changes.done = updates.done;
  }

  if (updates.estimatedHours !== undefined) {
    changes.estimated_hours = updates.estimatedHours;
  }

  if (Object.keys(changes).length === 0) {
    return this.getTask(id);
  }

  const { data, error } = await this.client
    .from('tasks')
    .update(changes)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to update task: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    category: data.category ?? undefined,
    dueWeek: data.due_week,
    estimatedHours: data.estimated_hours,
    spreadWeeks: data.spread_weeks,
    done: data.done,
  };
}

async addTasks(newTasks: NewTask[]) {
  // The ids already in use, so the new ones never clash with them.
  const { data: existing, error: idsError } = await this.client
    .from('tasks')
    .select('id');

  if (idsError) {
    throw new DatabaseError(`Failed to add tasks: ${idsError.message}`);
  }

  const taken = new Set(existing.map((row) => row.id as string));
  const rows = newTasks.map((newTask) => {
    const id = nextTaskId(newTask.courseId, taken);
    taken.add(id);
    return {
      id,
      course_id: newTask.courseId,
      title: newTask.title,
      due_week: newTask.dueWeek,
      estimated_hours: newTask.estimatedHours,
    };
  });

  // One insert for every row, so the database adds all of them or none.
  const { data, error } = await this.client
    .from('tasks')
    .insert(rows)
    .select('*');

  if (error) {
    throw new DatabaseError(`Failed to add tasks: ${error.message}`);
  }

  return data.map((task) => ({
    id: task.id,
    courseId: task.course_id,
    title: task.title,
    category: task.category ?? undefined,
    dueWeek: task.due_week,
    estimatedHours: task.estimated_hours,
    spreadWeeks: task.spread_weeks,
    done: task.done,
  }));
}

async addReview(review: NewReview) {
  const { data, error } = await this.client
    .from('reviews')
    .insert({
      course_id: review.courseId,
      title: review.title,
      hours: review.hours,
      comment: review.comment,
    })
    .select('id, course_id, title, hours, comment')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to add review: ${error.message}`);
  }

  return {
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    hours: data.hours,
    comment: data.comment,
  };
}

async listReviews(courseId: string) {
  const { data, error } = await this.client
    .from('reviews')
    .select('id, course_id, title, hours, comment')
    .eq('course_id', courseId)
    .order('id');

  if (error) {
    throw new DatabaseError(`Failed to load reviews: ${error.message}`);
  }

  return data.map((review) => ({
    id: review.id,
    courseId: review.course_id,
    title: review.title,
    hours: review.hours,
    comment: review.comment,
  }));
}

async getSemester() {
  const semester = await this.getSemesterRow();
  const courses = await this.listCourses();
  const tasks = await this.listTasks({});

  return {
    label: semester.label,
    currentWeek: semester.current_week,
    weeklyCapacity: semester.weekly_capacity,
    courses,
    tasks,
  };
}
}
