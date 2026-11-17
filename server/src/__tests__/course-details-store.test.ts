import { resetDb } from '../data/db';
import { DatabaseError } from '../data/database-error';
import { MemoryStore } from '../data/memory-store';
import type { Store } from '../data/store';

/**
 * #144: each student's check-in answers (#155) and week hours (#148),
 * against the in-memory store. supabase-course-details.test.ts checks that
 * the Supabase store sends the same things to the database. (The syllabus,
 * grade weight and policy tables were removed: nothing saved or read them.)
 */

const SAM = 'user-sam';
const ALEX = 'user-alex';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;


let store: Store;
beforeEach(async () => {
  resetDb();
  store = new MemoryStore();
  await store.loadSample('student-a');
});

describe('check-ins (each student)', () => {
  it('has none until the student answers', async () => {
    await expect(store.getCheckin(SAM, 'cs262')).resolves.toBeNull();
  });

  it('saves the answer with when it was given', async () => {
    const saved = await store.saveCheckin(SAM, 'cs262', 'on-schedule');
    expect(saved).toEqual({ courseId: 'cs262', answer: 'on-schedule', answeredAt: expect.stringMatching(ISO) });
    await expect(store.getCheckin(SAM, 'cs262')).resolves.toEqual(saved);
  });

  it('keeps only the latest answer', async () => {
    await store.saveCheckin(SAM, 'cs262', 'on-schedule');
    await store.saveCheckin(SAM, 'cs262', 'changed');
    await expect(store.getCheckin(SAM, 'cs262')).resolves.toMatchObject({ answer: 'changed' });
  });

  it("keeps each student's answers apart", async () => {
    await store.saveCheckin(SAM, 'cs262', 'changed');
    await expect(store.getCheckin(ALEX, 'cs262')).resolves.toBeNull();
  });

  it("keeps each course's answers apart", async () => {
    await store.saveCheckin(SAM, 'cs262', 'none-of-these');
    await expect(store.getCheckin(SAM, 'math251')).resolves.toBeNull();
  });

  it('records a later answer as later', async () => {
    const first = await store.saveCheckin(SAM, 'cs262', 'on-schedule');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.saveCheckin(SAM, 'cs262', 'changed');
    expect(Date.parse(second.answeredAt)).toBeGreaterThan(Date.parse(first.answeredAt));
  });

  it('refuses a course that does not exist', async () => {
    await expect(store.saveCheckin(SAM, 'nope', 'changed')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('week hours (each student, #148)', () => {
  it('has none until the student sets some', async () => {
    await expect(store.listWeekHours(SAM)).resolves.toEqual([]);
  });

  it('sets one week, and lists every set week in order', async () => {
    await store.setWeekHours(SAM, 6, 20);
    await expect(store.setWeekHours(SAM, 3, 10)).resolves.toEqual([
      { week: 3, hours: 10 },
      { week: 6, hours: 20 },
    ]);
    await expect(store.listWeekHours(SAM)).resolves.toEqual([
      { week: 3, hours: 10 },
      { week: 6, hours: 20 },
    ]);
  });

  it('changes a week that was already set', async () => {
    await store.setWeekHours(SAM, 6, 20);
    await store.setWeekHours(SAM, 6, 25);
    await expect(store.listWeekHours(SAM)).resolves.toEqual([{ week: 6, hours: 25 }]);
  });

  it('clears a week with null, so the weekly number applies again', async () => {
    await store.setWeekHours(SAM, 6, 20);
    await store.setWeekHours(SAM, 3, 10);
    await expect(store.setWeekHours(SAM, 6, null)).resolves.toEqual([{ week: 3, hours: 10 }]);
  });

  it('clearing a week that was never set does nothing', async () => {
    await expect(store.setWeekHours(SAM, 6, null)).resolves.toEqual([]);
  });

  it("keeps each student's weeks apart", async () => {
    await store.setWeekHours(SAM, 6, 20);
    await expect(store.listWeekHours(ALEX)).resolves.toEqual([]);
  });
});

describe('a fresh start', () => {
  it("resetDb clears each student's answers and week hours, like the rest of the in-memory data", async () => {
    await store.saveCheckin(SAM, 'cs262', 'changed');
    await store.setWeekHours(SAM, 6, 20);

    resetDb();
    const fresh = new MemoryStore();
    await expect(fresh.getCheckin(SAM, 'cs262')).resolves.toBeNull();
    await expect(fresh.listWeekHours(SAM)).resolves.toEqual([]);
  });

  it('leaves courses, tasks and reviews as they were', async () => {
    const before = await store.getSemester('student-a');
    await store.saveCheckin(SAM, 'cs262', 'changed');
    await store.setWeekHours(SAM, 6, 20);
    await expect(store.getSemester('student-a')).resolves.toEqual(before);
  });
});
