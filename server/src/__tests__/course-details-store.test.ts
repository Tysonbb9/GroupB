import { resetDb } from '../data/db';
import { DatabaseError } from '../data/database-error';
import { MemoryStore } from '../data/memory-store';
import type { Store } from '../data/store';

/**
 * #144: the course details the AI screens save (#123). These run against
 * the in-memory store; supabase-course-details.test.ts checks that the
 * Supabase store sends the same things to the database.
 */

const SAM = 'user-sam';
const ALEX = 'user-alex';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const weights = [
  { name: 'Team work', detail: 'project, demos, contract', percent: 40 },
  { name: 'Exams', detail: 'two midterms', percent: 30 },
  { name: 'Participation', detail: null, percent: 20 },
  { name: 'Quizzes', detail: null, percent: 10 },
];

let store: Store;
beforeEach(() => {
  resetDb();
  store = new MemoryStore();
});

describe('syllabi', () => {
  it('has no syllabus for a course until one is saved', async () => {
    await expect(store.getSyllabus('cs262')).resolves.toBeNull();
  });

  it('saves the text and reads it back', async () => {
    const saved = await store.saveSyllabus('cs262', 'Week 4: Prototype demo (6 hours)');
    expect(saved).toEqual({ courseId: 'cs262', text: 'Week 4: Prototype demo (6 hours)' });
    await expect(store.getSyllabus('cs262')).resolves.toEqual(saved);
  });

  it('keeps one syllabus per course: a new one replaces the old', async () => {
    await store.saveSyllabus('cs262', 'old');
    await store.saveSyllabus('cs262', 'new');
    await expect(store.getSyllabus('cs262')).resolves.toMatchObject({ text: 'new' });
  });

  it("keeps each course's syllabus apart", async () => {
    await store.saveSyllabus('cs262', 'software');
    await store.saveSyllabus('math251', 'linear algebra');
    await expect(store.getSyllabus('cs262')).resolves.toMatchObject({ text: 'software' });
    await expect(store.getSyllabus('math251')).resolves.toMatchObject({ text: 'linear algebra' });
  });

  it('refuses a course that does not exist, as the database would', async () => {
    await expect(store.saveSyllabus('nope', 'text')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('hands back a copy, so changing it does not change what is saved', async () => {
    const saved = await store.saveSyllabus('cs262', 'original');
    saved.text = 'changed by the caller';
    await expect(store.getSyllabus('cs262')).resolves.toMatchObject({ text: 'original' });
  });
});

describe('grade weights', () => {
  it('has none for a course until they are saved', async () => {
    await expect(store.listGradeWeights('cs262')).resolves.toEqual([]);
  });

  it('saves them, and lists them in the order given', async () => {
    await expect(store.replaceGradeWeights('cs262', weights)).resolves.toEqual(weights);
    await expect(store.listGradeWeights('cs262')).resolves.toEqual(weights);
  });

  it('replaces all of a course weights at once', async () => {
    await store.replaceGradeWeights('cs262', weights);
    const fixed = [{ name: 'Final exam', detail: null, percent: 100 }];
    await store.replaceGradeWeights('cs262', fixed);
    await expect(store.listGradeWeights('cs262')).resolves.toEqual(fixed);
  });

  it('clears them when given none', async () => {
    await store.replaceGradeWeights('cs262', weights);
    await store.replaceGradeWeights('cs262', []);
    await expect(store.listGradeWeights('cs262')).resolves.toEqual([]);
  });

  it("does not touch another course's weights", async () => {
    await store.replaceGradeWeights('cs262', weights);
    await store.replaceGradeWeights('math251', [{ name: 'Exams', detail: null, percent: 100 }]);
    await expect(store.listGradeWeights('cs262')).resolves.toEqual(weights);
  });

  it('refuses a course that does not exist, and saves nothing', async () => {
    await expect(store.replaceGradeWeights('nope', weights)).rejects.toBeInstanceOf(DatabaseError);
    await expect(store.listGradeWeights('nope')).resolves.toEqual([]);
  });

  it('keeps its own copy of what it was given', async () => {
    const given = structuredClone(weights);
    await store.replaceGradeWeights('cs262', given);
    given[0].percent = 1;
    await expect(store.listGradeWeights('cs262')).resolves.toEqual(weights);
  });
});

describe('course policies', () => {
  const policies = { late: { percentPerDay: 10, maxDays: 2 }, dropRule: 'lowest quiz' };

  it('has none for a course until they are saved', async () => {
    await expect(store.getCoursePolicies('cs262')).resolves.toBeNull();
  });

  it('saves them and reads them back', async () => {
    await expect(store.saveCoursePolicies('cs262', policies)).resolves.toEqual(policies);
    await expect(store.getCoursePolicies('cs262')).resolves.toEqual(policies);
  });

  it('saves a course with neither rule, which is different from never saved', async () => {
    const none = { late: null, dropRule: null };
    await store.saveCoursePolicies('cs262', none);
    await expect(store.getCoursePolicies('cs262')).resolves.toEqual(none);
  });

  it('replaces the earlier policies', async () => {
    await store.saveCoursePolicies('cs262', policies);
    await store.saveCoursePolicies('cs262', { late: null, dropRule: 'lowest lab' });
    await expect(store.getCoursePolicies('cs262')).resolves.toEqual({ late: null, dropRule: 'lowest lab' });
  });

  it('refuses a course that does not exist', async () => {
    await expect(store.saveCoursePolicies('nope', policies)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('leaves attendance on the course, where it already lives', async () => {
    await store.saveCoursePolicies('cs262', policies);
    await expect(store.getCourse('cs262')).resolves.toMatchObject({ attendance: { allowed: 4, used: 1 } });
  });
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
  it('resetDb clears every course detail, like the rest of the in-memory data', async () => {
    await store.saveSyllabus('cs262', 'text');
    await store.replaceGradeWeights('cs262', weights);
    await store.saveCoursePolicies('cs262', { late: null, dropRule: null });
    await store.saveCheckin(SAM, 'cs262', 'changed');
    await store.setWeekHours(SAM, 6, 20);

    resetDb();
    const fresh = new MemoryStore();
    await expect(fresh.getSyllabus('cs262')).resolves.toBeNull();
    await expect(fresh.listGradeWeights('cs262')).resolves.toEqual([]);
    await expect(fresh.getCoursePolicies('cs262')).resolves.toBeNull();
    await expect(fresh.getCheckin(SAM, 'cs262')).resolves.toBeNull();
    await expect(fresh.listWeekHours(SAM)).resolves.toEqual([]);
  });

  it('leaves courses, tasks and reviews as they were', async () => {
    const before = await store.getSemester();
    await store.saveSyllabus('cs262', 'text');
    await store.replaceGradeWeights('cs262', weights);
    await expect(store.getSemester()).resolves.toEqual(before);
  });
});
