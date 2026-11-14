import { DatabaseError } from '../data/database-error';
import { SupabaseStore } from '../data/supabase-store';

/**
 * #144: what the Supabase store sends for the course details, and how it
 * reads the answers. A stand-in client records every call, so no real
 * project is needed. The table and column names must match
 * server/db/migration_144_course_tables.sql; course-details-store.test.ts
 * covers the behaviour against the in-memory store.
 */

type Answer = { data: unknown; error: { message: string } | null };

/**
 * A stand-in for supabase-js. Every method returns the same chain and is
 * recorded; awaiting the chain gives the next answer in `answers`.
 */
function fakeDatabase(...answers: Answer[]) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, method: string) {
        if (method === 'then') {
          const answer = answers.shift() ?? { data: null, error: null };
          return (resolve: (value: Answer) => void) => resolve(answer);
        }
        return (...args: unknown[]) => {
          calls.push([method, ...args]);
          return chain;
        };
      },
    }
  );
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return chain;
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return chain;
    },
  };
  const store = new SupabaseStore('https://example.supabase.co', 'fake-test-key');
  Object.assign(store, { client });
  return { store, calls };
}

const ok = (data: unknown): Answer => ({ data, error: null });
const failed = (message: string): Answer => ({ data: null, error: { message } });
const ISO = /^\d{4}-\d{2}-\d{2}T/;

describe('syllabi', () => {
  it('reads one course syllabus from the syllabi table', async () => {
    const { store, calls } = fakeDatabase(ok({ course_id: 'cs262', text: 'Week 4', read_at: '2026-11-14T10:00:00+00:00' }));

    await expect(store.getSyllabus('cs262')).resolves.toEqual({
      courseId: 'cs262',
      text: 'Week 4',
      readAt: '2026-11-14T10:00:00.000Z',
    });
    expect(calls).toEqual([
      ['from', 'syllabi'],
      ['select', 'course_id, text, read_at'],
      ['eq', 'course_id', 'cs262'],
      ['maybeSingle'],
    ]);
  });

  it('answers null when the course has no syllabus', async () => {
    const { store } = fakeDatabase(ok(null));
    await expect(store.getSyllabus('cs262')).resolves.toBeNull();
  });

  it('saves by replacing the course row (upsert on course_id), timed now', async () => {
    const { store, calls } = fakeDatabase(ok({ course_id: 'cs262', text: 'new', read_at: '2026-11-14T10:00:00Z' }));

    await store.saveSyllabus('cs262', 'new');
    const [, row, options] = calls.find(([method]) => method === 'upsert')!;
    expect(row).toEqual({ course_id: 'cs262', text: 'new', read_at: expect.stringMatching(ISO) });
    expect(options).toEqual({ onConflict: 'course_id' });
  });

  it.each([
    ['getSyllabus', (store: SupabaseStore) => store.getSyllabus('cs262'), 'Failed to load syllabus: boom'],
    ['saveSyllabus', (store: SupabaseStore) => store.saveSyllabus('cs262', 'x'), 'Failed to save syllabus: boom'],
  ])('%s turns a database error into a DatabaseError', async (_name, call, message) => {
    const { store } = fakeDatabase(failed('boom'));
    const error = await call(store).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as Error).message).toBe(message);
  });
});

describe('grade weights', () => {
  it('lists a course weights in position order', async () => {
    const { store, calls } = fakeDatabase(
      ok([
        { name: 'Exams', detail: 'two midterms', percent: 60 },
        { name: 'Quizzes', detail: null, percent: '40' },
      ])
    );

    await expect(store.listGradeWeights('cs262')).resolves.toEqual([
      { name: 'Exams', detail: 'two midterms', percent: 60 },
      // Postgres numeric can arrive as text; it is read as a number.
      { name: 'Quizzes', detail: null, percent: 40 },
    ]);
    expect(calls).toEqual([
      ['from', 'grade_weights'],
      ['select', 'name, detail, percent'],
      ['eq', 'course_id', 'cs262'],
      ['order', 'position'],
    ]);
  });

  it('replaces them in one database call, so it is all or nothing', async () => {
    const { store, calls } = fakeDatabase(
      ok([
        { position: 2, name: 'Quizzes', detail: null, percent: 40 },
        { position: 1, name: 'Exams', detail: 'two midterms', percent: 60 },
      ])
    );

    const saved = await store.replaceGradeWeights('cs262', [
      { name: 'Exams', detail: 'two midterms', percent: 60 },
      { name: 'Quizzes', detail: null, percent: 40 },
    ]);
    expect(calls).toEqual([
      [
        'rpc',
        'replace_grade_weights',
        {
          p_course_id: 'cs262',
          p_weights: [
            { name: 'Exams', detail: 'two midterms', percent: 60 },
            { name: 'Quizzes', detail: null, percent: 40 },
          ],
        },
      ],
    ]);
    // Put back in position order, whatever order the database answers in.
    expect(saved.map((weight) => weight.name)).toEqual(['Exams', 'Quizzes']);
  });

  it('sends only the three fields, whatever else the caller passes', async () => {
    const { store, calls } = fakeDatabase(ok([]));
    const extra = { name: 'Exams', detail: null, percent: 100, position: 99, course_id: 'other' };
    await store.replaceGradeWeights('cs262', [extra]);
    expect(calls[0][2]).toEqual({ p_course_id: 'cs262', p_weights: [{ name: 'Exams', detail: null, percent: 100 }] });
  });

  it('clears them with an empty list', async () => {
    const { store, calls } = fakeDatabase(ok([]));
    await expect(store.replaceGradeWeights('cs262', [])).resolves.toEqual([]);
    expect(calls[0][2]).toEqual({ p_course_id: 'cs262', p_weights: [] });
  });

  it.each([
    ['listGradeWeights', (store: SupabaseStore) => store.listGradeWeights('cs262'), 'Failed to load grade weights: boom'],
    ['replaceGradeWeights', (store: SupabaseStore) => store.replaceGradeWeights('cs262', []), 'Failed to save grade weights: boom'],
  ])('%s turns a database error into a DatabaseError', async (_name, call, message) => {
    const { store } = fakeDatabase(failed('boom'));
    await expect(call(store)).rejects.toThrow(new DatabaseError(message));
  });
});

describe('course policies', () => {
  it('reads both rules', async () => {
    const { store, calls } = fakeDatabase(ok({ late_percent_per_day: '10', late_max_days: 2, drop_rule: 'lowest quiz' }));

    await expect(store.getCoursePolicies('cs262')).resolves.toEqual({
      late: { percentPerDay: 10, maxDays: 2 },
      dropRule: 'lowest quiz',
    });
    expect(calls).toEqual([
      ['from', 'course_policies'],
      ['select', 'late_percent_per_day, late_max_days, drop_rule'],
      ['eq', 'course_id', 'cs262'],
      ['maybeSingle'],
    ]);
  });

  it('reads a course with neither rule', async () => {
    const { store } = fakeDatabase(ok({ late_percent_per_day: null, late_max_days: null, drop_rule: null }));
    await expect(store.getCoursePolicies('cs262')).resolves.toEqual({ late: null, dropRule: null });
  });

  it('answers null when they were never saved', async () => {
    const { store } = fakeDatabase(ok(null));
    await expect(store.getCoursePolicies('cs262')).resolves.toBeNull();
  });

  it('saves the late rule as two columns, upserting on course_id', async () => {
    const { store, calls } = fakeDatabase(ok({ late_percent_per_day: 10, late_max_days: 2, drop_rule: 'lowest quiz' }));

    await store.saveCoursePolicies('cs262', { late: { percentPerDay: 10, maxDays: 2 }, dropRule: 'lowest quiz' });
    const [, row, options] = calls.find(([method]) => method === 'upsert')!;
    expect(row).toEqual({ course_id: 'cs262', late_percent_per_day: 10, late_max_days: 2, drop_rule: 'lowest quiz' });
    expect(options).toEqual({ onConflict: 'course_id' });
  });

  it('saves no late rule as two empty columns', async () => {
    const { store, calls } = fakeDatabase(ok({ late_percent_per_day: null, late_max_days: null, drop_rule: null }));
    await store.saveCoursePolicies('cs262', { late: null, dropRule: null });
    const [, row] = calls.find(([method]) => method === 'upsert')!;
    expect(row).toEqual({ course_id: 'cs262', late_percent_per_day: null, late_max_days: null, drop_rule: null });
  });

  it('turns a database error into a DatabaseError', async () => {
    const { store } = fakeDatabase(failed('boom'));
    await expect(store.saveCoursePolicies('cs262', { late: null, dropRule: null })).rejects.toThrow(
      new DatabaseError('Failed to save course policies: boom')
    );
  });
});

describe('check-ins', () => {
  it("reads one student's answer for one course", async () => {
    const { store, calls } = fakeDatabase(ok({ course_id: 'cs262', answer: 'changed', answered_at: '2026-11-14T10:00:00Z' }));

    await expect(store.getCheckin('user-sam', 'cs262')).resolves.toEqual({
      courseId: 'cs262',
      answer: 'changed',
      answeredAt: '2026-11-14T10:00:00.000Z',
    });
    expect(calls).toEqual([
      ['from', 'course_checkins'],
      ['select', 'course_id, answer, answered_at'],
      ['eq', 'user_id', 'user-sam'],
      ['eq', 'course_id', 'cs262'],
      ['maybeSingle'],
    ]);
  });

  it('answers null when the student never answered', async () => {
    const { store } = fakeDatabase(ok(null));
    await expect(store.getCheckin('user-sam', 'cs262')).resolves.toBeNull();
  });

  it('keeps one answer per student and course (upsert), timed now', async () => {
    const { store, calls } = fakeDatabase(ok({ course_id: 'cs262', answer: 'on-schedule', answered_at: '2026-11-14T10:00:00Z' }));

    await store.saveCheckin('user-sam', 'cs262', 'on-schedule');
    const [, row, options] = calls.find(([method]) => method === 'upsert')!;
    expect(row).toEqual({
      user_id: 'user-sam',
      course_id: 'cs262',
      answer: 'on-schedule',
      answered_at: expect.stringMatching(ISO),
    });
    expect(options).toEqual({ onConflict: 'user_id,course_id' });
  });

  it('turns a database error into a DatabaseError', async () => {
    const { store } = fakeDatabase(failed('boom'));
    await expect(store.saveCheckin('user-sam', 'cs262', 'changed')).rejects.toThrow(
      new DatabaseError('Failed to save check-in: boom')
    );
  });
});

describe('week hours', () => {
  it("lists a student's weeks in week order", async () => {
    const { store, calls } = fakeDatabase(ok([{ week: 3, hours: 10 }, { week: 6, hours: 20 }]));

    await expect(store.listWeekHours('user-sam')).resolves.toEqual([
      { week: 3, hours: 10 },
      { week: 6, hours: 20 },
    ]);
    expect(calls).toEqual([
      ['from', 'week_hours'],
      ['select', 'week, hours'],
      ['eq', 'user_id', 'user-sam'],
      ['order', 'week'],
    ]);
  });

  it('sets a week by upserting on user and week, then lists them all', async () => {
    const { store, calls } = fakeDatabase(ok(null), ok([{ week: 6, hours: 20 }]));

    await expect(store.setWeekHours('user-sam', 6, 20)).resolves.toEqual([{ week: 6, hours: 20 }]);
    expect(calls.slice(0, 2)).toEqual([
      ['from', 'week_hours'],
      ['upsert', { user_id: 'user-sam', week: 6, hours: 20 }, { onConflict: 'user_id,week' }],
    ]);
  });

  it('clears a week by deleting that one row', async () => {
    const { store, calls } = fakeDatabase(ok(null), ok([]));

    await store.setWeekHours('user-sam', 6, null);
    expect(calls.slice(0, 4)).toEqual([
      ['from', 'week_hours'],
      ['delete'],
      ['eq', 'user_id', 'user-sam'],
      ['eq', 'week', 6],
    ]);
  });

  it('does not list the weeks when saving failed', async () => {
    const { store, calls } = fakeDatabase(failed('boom'));

    await expect(store.setWeekHours('user-sam', 6, 20)).rejects.toThrow(new DatabaseError('Failed to save week hours: boom'));
    expect(calls.filter(([method]) => method === 'from')).toHaveLength(1);
  });

  it('turns a database error while listing into a DatabaseError', async () => {
    const { store } = fakeDatabase(failed('boom'));
    await expect(store.listWeekHours('user-sam')).rejects.toThrow(new DatabaseError('Failed to load week hours: boom'));
  });
});
