
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';
import { resetDb } from '../data/db';
import type { Store } from '../data/store';
import { signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn(); // every route outside /api/auth needs a session
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabaseStudent = process.env.SUPABASE_TEST_USER_ID;

// Run Supabase read-only tests only when credentials exist.
const describeSupabase =
  supabaseUrl && supabaseKey && supabaseStudent ? describe : describe.skip;

// Shared read-only contract tests for both stores.
function runReadOnlyContractTests(
  createStore: () => Store,
  userId = 'student-a'
) {
  it('TP-40: returns a semester with the correct shape', async () => {
    const store = createStore();
    const semester = await store.getSemester(userId);

    expect(typeof semester.label).toBe('string');
    expect(typeof semester.currentWeek).toBe('number');
    expect(typeof semester.weeklyCapacity).toBe('number');
    expect(Array.isArray(semester.courses)).toBe(true);
    expect(Array.isArray(semester.tasks)).toBe(true);
  }, 20000);

  it('TP-42: returns null for an unknown task ID', async () => {
    const store = createStore();

    const task = await store.getTask(userId, 'does-not-exist');

    expect(task).toBeNull();
  }, 20000);
}

describe('Store Contract — MemoryStore', () => {
  beforeEach(async () => { resetDb(); await new MemoryStore().loadSample('student-a'); });

  runReadOnlyContractTests(() => new MemoryStore());

  it('TP-41: task updates persist when retrieved again', async () => {
    const store = new MemoryStore();

    const original = await store.getTask('student-a', '262-2');
    expect(original).not.toBeNull();

    await store.updateTask('student-a', '262-2', { done: true });

    const updated = await store.getTask('student-a', '262-2');

    expect(updated).not.toBeNull();
    expect(updated?.done).toBe(true);
  });
});


describeSupabase('Store Contract — SupabaseStore', () => {
  runReadOnlyContractTests(
    () => new SupabaseStore(supabaseUrl!, supabaseKey!), supabaseStudent!
  );

  const runWriteTest =
    process.env.RUN_SUPABASE_WRITE_TESTS === 'true'
      ? it
      : it.skip;

  runWriteTest(
    'TP-41: task updates persist in Supabase across store instances',
    async () => {
      const taskId = '262-2';
      const store = new SupabaseStore(supabaseUrl!, supabaseKey!);

      const original = await store.getTask(supabaseStudent!, taskId);
      expect(original).not.toBeNull();

      if (!original) {
        throw new Error('Sample task not found');
      }

      const originalDone = original.done;
      const changedDone = !originalDone;
      let updateAttempted = false;

      try {
        updateAttempted = true;

        const updated = await store.updateTask(supabaseStudent!, taskId, {
          done: changedDone,
        });

        expect(updated?.done).toBe(changedDone);

        // A new store instance reads from Supabase again.
        const freshStore = new SupabaseStore(
          supabaseUrl!,
          supabaseKey!
        );

        const persisted = await freshStore.getTask(supabaseStudent!, taskId);

        expect(persisted).not.toBeNull();
        expect(persisted?.done).toBe(changedDone);
      } finally {
        if (updateAttempted) {
          // Restore the original sample data.
          const restoreStore = new SupabaseStore(
            supabaseUrl!,
            supabaseKey!
          );

          await restoreStore.updateTask(supabaseStudent!, taskId, {
            done: originalDone,
          });

          const restored = await restoreStore.getTask(supabaseStudent!, taskId);
          expect(restored?.done).toBe(originalDone);
        }
      }
    },
    30000
  );
});

describe('TP-42: API unknown task handling', () => {
  it('returns 404 JSON instead of 500 for an unknown task', async () => {
    const response = await api.get('/tasks/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Task not found',
    });
  });
});
