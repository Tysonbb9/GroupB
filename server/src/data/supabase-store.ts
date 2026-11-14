import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask, SemesterUpdates } from './store';
import { DatabaseError } from './database-error';
import { nextTaskId } from './task-ids';
import type { CheckinAnswer, CoursePolicies, GradeWeight } from '../types';

/** Postgres timestamps arrive as text with an offset; the API uses ISO in UTC. */
const toIso = (timestamp: string) => new Date(timestamp).toISOString();

type GradeWeightRow = { name: string; detail: string | null; percent: number | string };
type PoliciesRow = { late_percent_per_day: number | string | null; late_max_days: number | null; drop_rule: string | null };

function toGradeWeight(row: GradeWeightRow): GradeWeight {
  // Postgres numeric can arrive as text, so it is read as a number.
  return { name: row.name, detail: row.detail, percent: Number(row.percent) };
}

function toPolicies(row: PoliciesRow): CoursePolicies {
  return {
    late:
      row.late_percent_per_day === null || row.late_max_days === null
        ? null
        : { percentPerDay: Number(row.late_percent_per_day), maxDays: row.late_max_days },
    dropRule: row.drop_rule,
  };
}

export class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.client = createClient(url, secretKey);
  }

private async getSemesterRow() {
  const { data, error } = await this.client
    .from('semester')
    .select('id, label, current_week, weekly_capacity')
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

async updateSemester(updates: SemesterUpdates) {
  if (updates.weeklyCapacity !== undefined) {
    // The table holds exactly one row. Supabase refuses an update that names
    // no row, so read that row's id and update it by id.
    const { id } = await this.getSemesterRow();
    const { error } = await this.client
      .from('semester')
      .update({ weekly_capacity: updates.weeklyCapacity })
      .eq('id', id);

    if (error) {
      throw new DatabaseError(`Failed to update semester: ${error.message}`);
    }
  }

  return this.getSemester();
}

// ---------------------------------------------------------------------------
// Course details for the AI screens (#144). Tables are in
// server/db/migration_144_course_tables.sql.
// ---------------------------------------------------------------------------

async getSyllabus(courseId: string) {
  const { data, error } = await this.client
    .from('syllabi')
    .select('course_id, text, read_at')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load syllabus: ${error.message}`);
  }

  return data ? { courseId: data.course_id, text: data.text, readAt: toIso(data.read_at) } : null;
}

async saveSyllabus(courseId: string, text: string) {
  // One syllabus per course: a second save replaces the first.
  const { data, error } = await this.client
    .from('syllabi')
    .upsert({ course_id: courseId, text, read_at: new Date().toISOString() }, { onConflict: 'course_id' })
    .select('course_id, text, read_at')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save syllabus: ${error.message}`);
  }

  return { courseId: data.course_id, text: data.text, readAt: toIso(data.read_at) };
}

async listGradeWeights(courseId: string) {
  const { data, error } = await this.client
    .from('grade_weights')
    .select('name, detail, percent')
    .eq('course_id', courseId)
    .order('position');

  if (error) {
    throw new DatabaseError(`Failed to load grade weights: ${error.message}`);
  }

  return (data as GradeWeightRow[]).map(toGradeWeight);
}

async replaceGradeWeights(courseId: string, weights: GradeWeight[]) {
  // One call to a database function that deletes and inserts in the same
  // transaction, so a failure leaves the old weights, never half of each.
  const { data, error } = await this.client.rpc('replace_grade_weights', {
    p_course_id: courseId,
    p_weights: weights.map(({ name, detail, percent }) => ({ name, detail, percent })),
  });

  if (error) {
    throw new DatabaseError(`Failed to save grade weights: ${error.message}`);
  }

  return (data as (GradeWeightRow & { position: number })[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(toGradeWeight);
}

async getCoursePolicies(courseId: string) {
  const { data, error } = await this.client
    .from('course_policies')
    .select('late_percent_per_day, late_max_days, drop_rule')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load course policies: ${error.message}`);
  }

  return data ? toPolicies(data) : null;
}

async saveCoursePolicies(courseId: string, policies: CoursePolicies) {
  const { data, error } = await this.client
    .from('course_policies')
    .upsert(
      {
        course_id: courseId,
        late_percent_per_day: policies.late?.percentPerDay ?? null,
        late_max_days: policies.late?.maxDays ?? null,
        drop_rule: policies.dropRule,
      },
      { onConflict: 'course_id' }
    )
    .select('late_percent_per_day, late_max_days, drop_rule')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save course policies: ${error.message}`);
  }

  return toPolicies(data);
}

async getCheckin(userId: string, courseId: string) {
  const { data, error } = await this.client
    .from('course_checkins')
    .select('course_id, answer, answered_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load check-in: ${error.message}`);
  }

  return data ? { courseId: data.course_id, answer: data.answer, answeredAt: toIso(data.answered_at) } : null;
}

async saveCheckin(userId: string, courseId: string, answer: CheckinAnswer) {
  // One row per student and course: the latest answer replaces the last.
  const { data, error } = await this.client
    .from('course_checkins')
    .upsert(
      { user_id: userId, course_id: courseId, answer, answered_at: new Date().toISOString() },
      { onConflict: 'user_id,course_id' }
    )
    .select('course_id, answer, answered_at')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save check-in: ${error.message}`);
  }

  return { courseId: data.course_id, answer: data.answer, answeredAt: toIso(data.answered_at) };
}

async listWeekHours(userId: string) {
  const { data, error } = await this.client
    .from('week_hours')
    .select('week, hours')
    .eq('user_id', userId)
    .order('week');

  if (error) {
    throw new DatabaseError(`Failed to load week hours: ${error.message}`);
  }

  return data.map((row) => ({ week: row.week, hours: Number(row.hours) }));
}

async setWeekHours(userId: string, week: number, hours: number | null) {
  // Clearing a week deletes its row, so the weekly number applies again.
  const { error } =
    hours === null
      ? await this.client.from('week_hours').delete().eq('user_id', userId).eq('week', week)
      : await this.client.from('week_hours').upsert({ user_id: userId, week, hours }, { onConflict: 'user_id,week' });

  if (error) {
    throw new DatabaseError(`Failed to save week hours: ${error.message}`);
  }

  return this.listWeekHours(userId);
}
}
