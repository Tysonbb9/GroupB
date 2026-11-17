import { SupabaseStore } from '../data/supabase-store';
import { DatabaseError } from '../data/database-error';
import { DEFAULT_WEEKLY_CAPACITY } from '../data/semester';

// Exercise the actual PostgREST requests without a hosted database or secret key.
let calls: { url: URL; method: string; body: any }[];
let respond: (url: URL, method: string, body: any) => unknown;
beforeEach(() => {
  calls = [];
  respond = () => [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    const method = options?.method ?? 'GET';
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    calls.push({ url, method, body });
    return new Response(JSON.stringify(respond(url, method, body)), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
});
afterEach(() => jest.restoreAllMocks());
const create = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

test('all task reads and updates filter the student in the outgoing request', async () => {
  const store = create();
  await store.getTask('alice', '262-2');
  await store.listTasks('alice', { courseId: 'cs262', done: false });
  await store.updateTask('alice', '262-2', { done: true });
  expect(calls).toHaveLength(3);
  for (const call of calls) expect(call.url.searchParams.get('user_id')).toBe('eq.alice');
  expect(calls[0].url.searchParams.get('id')).toBe('eq.262-2');
  expect(calls[2].method).toBe('PATCH');
  expect(calls[2].body).toEqual({ done: true });
});

test('course reads require an inner enrollment match and omit enrollment rows from the API shape', async () => {
  respond = () => [{ id: 'cs262', code: 'CS 262', name: 'Software', attendance_allowed: null, attendance_used: null, enrollments: [{ user_id: 'alice' }] }];
  const store = create();
  const courses = await store.listCourses('alice');
  await store.getCourse('alice', 'cs262');
  for (const call of calls) {
    expect(call.url.searchParams.get('enrollments.user_id')).toBe('eq.alice');
    expect(call.url.searchParams.get('select')).toContain('enrollments!inner(user_id)');
  }
  expect(courses).toEqual([{ id: 'cs262', code: 'CS 262', name: 'Software', attendance: null }]);
});

test('task creation uses a student-scoped atomic RPC', async () => {
  respond = (url, method, body) => {
    if (url.pathname !== '/rest/v1/rpc/add_student_tasks') return [];
    return body.p_tasks.map((task: any, i: number) => ({
      id: `${task.courseId}-syl-${i + 1}`,
      user_id: body.p_user_id,
      course_id: task.courseId,
      title: task.title,
      due_week: task.dueWeek,
      estimated_hours: task.estimatedHours,
      spread_weeks: 1,
      done: false,
      category: null,
    }));
  };

  const store = create();
  const tasks = [{ courseId: 'cs262', title: 'Own task', dueWeek: 3, estimatedHours: 2 }];

  const first = await store.addTasks('alice', tasks);
  const second = await store.addTasks('bob', tasks);

  expect(first[0].id).toBe(second[0].id);
  expect(first[0]).not.toHaveProperty('user_id');
  expect(calls).toHaveLength(2);

  for (const [index, student] of ['alice', 'bob'].entries()) {
    expect(calls[index].method).toBe('POST');
    expect(calls[index].url.pathname).toBe('/rest/v1/rpc/add_student_tasks');
    expect(calls[index].body).toEqual({
      p_user_id: student,
      p_tasks: tasks,
    });
  }
});

test('capacity is upserted by student and an absent settings row uses fifteen hours', async () => {
  respond = (url) => url.pathname.endsWith('/semester') ? { label: 'Fall', current_week: 3, weekly_capacity: 79 } : [];
  const semester = await create().updateSemester('alice', { weeklyCapacity: 20 });
  const write = calls.find(call => call.method === 'POST')!;
  expect(write.url.pathname).toBe('/rest/v1/student_settings');
  expect(write.body).toEqual({ user_id: 'alice', weekly_capacity: 20 });
  expect(write.url.searchParams.get('on_conflict')).toBe('user_id');
  expect(semester.weeklyCapacity).toBe(15);
  expect(calls.filter(call => call.url.pathname.endsWith('/semester')).every(call => call.method === 'GET')).toBe(true);
});

test('sample copy uses one transactional request and an occupied account is returned as null', async () => {
  respond = () => false;
  expect(await create().loadSample('alice')).toBeNull();
  expect(calls).toHaveLength(1);
  expect(calls[0].url.pathname).toBe('/rest/v1/rpc/load_sample_semester');
  expect(calls[0].body.p_user_id).toBe('alice');
  expect(calls[0].body.p_weekly_capacity).toBe(DEFAULT_WEEKLY_CAPACITY);
  expect(calls[0].body.p_course_ids).toHaveLength(5);
  expect(calls[0].body.p_tasks).toHaveLength(36);
});

test('a rejected sample transaction becomes a DatabaseError without fallback writes', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ message: 'Transaction rejected' }), { status: 400 }));
  await expect(create().loadSample('alice')).rejects.toBeInstanceOf(DatabaseError);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
