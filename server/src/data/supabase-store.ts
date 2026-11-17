import { normalizeCourseCode, courseIdBase, type NewCourse } from './course-catalog';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask, SemesterUpdates } from './store';
import { DatabaseError } from './database-error';
import { semester as sample, DEFAULT_WEEKLY_CAPACITY } from './semester';
import type { Category, CheckinAnswer, CoursePolicies, GradeWeight } from '../types';

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

type CourseRow = { id: string; code: string; name: string; attendance_allowed: number | null; attendance_used: number | null };
function toCourse(row: CourseRow) {
  return { id: row.id, code: row.code, name: row.name, attendance: row.attendance_allowed === null ? null : { allowed: row.attendance_allowed, used: row.attendance_used! } };
}

export class SupabaseStore implements Store {
  private client: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.client = createClient(url, secretKey);
  }

private async getSemesterRow() {
  const { data, error } = await this.client
    .from('semester')
    .select('id, label, current_week')
    .single();
    if (error) {
        throw new DatabaseError(`Failed to load semester: ${error.message}`);
}


  return data;
}

async searchCatalog(userId: string, query: string) {
  const { data, error } = await this.client.rpc('search_course_catalog', {
    p_user_id: userId, p_code_query: normalizeCourseCode(query.trim()), p_name_query: query.trim(),
  });
  if (error) throw new DatabaseError(`Failed to search catalog: ${error.message}`);
  return (data as (CourseRow & { enrolled: boolean })[]).map(row => ({ ...toCourse(row), enrolled: row.enrolled }));
}

async enroll(userId: string, courseId: string) {
  // Catalog lookup deliberately includes courses the student has not joined yet.
  const { data, error } = await this.client.from('courses')
    .select('id, code, name, attendance_allowed, attendance_used').eq('id', courseId).maybeSingle();
  if (error) throw new DatabaseError(`Failed to load course: ${error.message}`);
  if (!data) return null;
  const { error: joinError } = await this.client.from('enrollments')
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
  if (joinError) throw new DatabaseError(`Failed to enroll: ${joinError.message}`);
  return toCourse(data);
}

async createCourse(userId: string, input: NewCourse) {
  const code = input.code.trim(), name = input.name.trim();
  const { data, error } = await this.client.rpc('create_catalog_course', {
    p_user_id: userId, p_code: code, p_name: name,
    p_code_key: normalizeCourseCode(code), p_id_base: courseIdBase(code),
  });
  if (error) throw new DatabaseError(`Failed to create course: ${error.message}`);
  const row = (data as (CourseRow & { created: boolean })[])[0];
  if (!row) throw new DatabaseError('Failed to create course: no course returned');
  return { created: row.created, course: toCourse(row) };
}

async listCourses(userId: string) {
  const { data, error } = await this.client
    .from('courses')
    .select('id, code, name, attendance_allowed, attendance_used, enrollments!inner(user_id)')
    .eq('enrollments.user_id', userId)
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

async getCourse(userId: string, id: string) {
  const { data, error } = await this.client
    .from('courses')
    .select('id, code, name, attendance_allowed, attendance_used, enrollments!inner(user_id)')
    .eq('enrollments.user_id', userId)
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

async getTask(userId: string, id: string) {
  const { data, error } = await this.client
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
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

async listTasks(userId: string, filters: TaskFilters) {
  let query = this.client
    .from('tasks')
    .select('*')
    .eq('user_id', userId);

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

async updateTask(userId: string, id: string, updates: TaskUpdates) {
  const changes: Record<string, boolean | number | null> = {};

  if (updates.done !== undefined) {
    changes.done = updates.done;
  }

  if (updates.estimatedHours !== undefined) {
    changes.estimated_hours = updates.estimatedHours;
  }

  if (updates.dueWeek !== undefined) {
    changes.due_week = updates.dueWeek;
  }

  // Every field is gathered before this check. It used to come before due_week,
  // so a change of week alone (the check-in card, #155) was never saved.
  if (Object.keys(changes).length === 0) {
    return this.getTask(userId, id);
  }

  const { data, error } = await this.client
    .from('tasks')
    .update(changes)
    .eq('user_id', userId)
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

async addTasks(userId: string, newTasks: NewTask[]) {
  // The database assigns IDs while holding a per-student transaction lock.
  // This prevents overlapping requests from choosing the same task ID.
  const { data, error } = await this.client.rpc('add_student_tasks', {
    p_user_id: userId,
    p_tasks: newTasks,
  });

  if (error) {
    throw new DatabaseError(`Failed to add tasks: ${error.message}`);
  }

  if (!data) {
    throw new DatabaseError('Failed to add tasks: no tasks returned');
  }

  return (data as Array<{
    id: string;
    course_id: string;
    title: string;
    category: Category | null;
    due_week: number;
    estimated_hours: number | null;
    spread_weeks: number;
    done: boolean;
  }>).map((task) => ({
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

async getSemester(userId: string) {
  const [semester, courses, tasks, settings] = await Promise.all([
    this.getSemesterRow(), this.listCourses(userId), this.listTasks(userId, {}),
    this.client.from('student_settings').select('weekly_capacity').eq('user_id', userId).maybeSingle(),
  ]);
  if (settings.error) throw new DatabaseError(`Failed to load student settings: ${settings.error.message}`);
  return {
    label: semester.label,
    currentWeek: semester.current_week,
    weeklyCapacity: settings.data ? Number(settings.data.weekly_capacity) : DEFAULT_WEEKLY_CAPACITY,
    courses,
    tasks,
  };
}

async updateSemester(userId: string, updates: SemesterUpdates) {
  if (updates.weeklyCapacity !== undefined) {
    const { error } = await this.client.from('student_settings')
      .upsert({ user_id: userId, weekly_capacity: updates.weeklyCapacity }, { onConflict: 'user_id' });
    if (error) throw new DatabaseError(`Failed to update student settings: ${error.message}`);
  }
  return this.getSemester(userId);
}

// One transaction checks emptiness, enrolls, copies tasks and fills missing capacity.
// Locking the student's row also serializes simultaneous sample requests.
async loadSample(userId: string) {
  const { data, error } = await this.client.rpc('load_sample_semester', {
    p_user_id: userId,
    p_weekly_capacity: DEFAULT_WEEKLY_CAPACITY,
    p_course_ids: sample.courses.map(course => course.id),
    p_tasks: sample.tasks.map(task => ({
      id: task.id, course_id: task.courseId, title: task.title, category: task.category ?? null,
      due_week: task.dueWeek, estimated_hours: task.estimatedHours,
      spread_weeks: task.spreadWeeks ?? 1, done: task.done,
    })),
  });
  if (error) throw new DatabaseError(`Failed to load sample semester: ${error.message}`);
  return data ? this.getSemester(userId) : null;
}

// ---------------------------------------------------------------------------
// Course details for the AI screens (#144). Tables are in
// server/db/migration_144_course_tables.sql.
// ---------------------------------------------------------------------------

async getSyllabus(courseId: string) {
  const { data, error } = await this.client
    .from('syllabi')
    .select('course_id, text')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Failed to load syllabus: ${error.message}`);
  }

  return data ? { courseId: data.course_id, text: data.text } : null;
}

async saveSyllabus(courseId: string, text: string) {
  // One syllabus per course: a second save replaces the first.
  const { data, error } = await this.client
    .from('syllabi')
    .upsert({ course_id: courseId, text }, { onConflict: 'course_id' })
    .select('course_id, text')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save syllabus: ${error.message}`);
  }

  return { courseId: data.course_id, text: data.text };
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

async getCalendarLink(userId: string) {
  const { data, error } = await this.client
    .from('calendar_links')
    .select('url, saved_at')
    .eq('user_id', userId)
    .maybeSingle();

  // The message names the table, never the link, which holds a private token.
  if (error) {
    throw new DatabaseError(`Failed to load the calendar link: ${error.message}`);
  }

  return data ? { url: data.url, savedAt: toIso(data.saved_at) } : null;
}

async saveCalendarLink(userId: string, url: string) {
  const { data, error } = await this.client
    .from('calendar_links')
    .upsert({ user_id: userId, url, saved_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('url, saved_at')
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save the calendar link: ${error.message}`);
  }

  return { url: data.url, savedAt: toIso(data.saved_at) };
}
}
