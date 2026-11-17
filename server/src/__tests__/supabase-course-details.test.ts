import { DatabaseError } from '../data/database-error';
import { SupabaseStore } from '../data/supabase-store';

/**
 * #144: what the Supabase store sends for each student's check-in answers
 * and week hours, and how it reads the answers. A stand-in client records every call, so no real
 * project is needed. The table and column names must match
 * server/db/schema.sql; course-details-store.test.ts
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
