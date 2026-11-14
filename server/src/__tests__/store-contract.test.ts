
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

// Run Supabase read-only tests only when credentials exist.
const describeSupabase =
  supabaseUrl && supabaseKey ? describe : describe.skip;

// Shared read-only contract tests for both stores.
function runReadOnlyContractTests(
  createStore: () => Store
) {
  it('TP-40: returns a semester with the correct shape', async () => {
    const store = createStore();
    const semester = await store.getSemester();

    expect(typeof semester.label).toBe('string');
    expect(typeof semester.currentWeek).toBe('number');
    expect(typeof semester.weeklyCapacity).toBe('number');
    expect(Array.isArray(semester.courses)).toBe(true);
    expect(Array.isArray(semester.tasks)).toBe(true);
  }, 20000);

  it('TP-42: returns null for an unknown task ID', async () => {
    const store = createStore();

    const task = await store.getTask('does-not-exist');

    expect(task).toBeNull();
  }, 20000);
}

describe('Store Contract — MemoryStore', () => {
  beforeEach(() => resetDb());

  runReadOnlyContractTests(() => new MemoryStore());

  it('TP-41: task updates persist when retrieved again', async () => {
    const store = new MemoryStore();

    const original = await store.getTask('262-2');
    expect(original).not.toBeNull();

    await store.updateTask('262-2', { done: true });

    const updated = await store.getTask('262-2');

    expect(updated).not.toBeNull();
    expect(updated?.done).toBe(true);
  });
});


describeSupabase('Store Contract — SupabaseStore', () => {
  runReadOnlyContractTests(
    () => new SupabaseStore(supabaseUrl!, supabaseKey!)
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

      const original = await store.getTask(taskId);
      expect(original).not.toBeNull();

      if (!original) {
        throw new Error('Sample task not found');
      }

      const originalDone = original.done;
      const changedDone = !originalDone;
      let updateAttempted = false;

      try {
        updateAttempted = true;

        const updated = await store.updateTask(taskId, {
          done: changedDone,
        });

        expect(updated?.done).toBe(changedDone);

        // A new store instance reads from Supabase again.
        const freshStore = new SupabaseStore(
          supabaseUrl!,
          supabaseKey!
        );

        const persisted = await freshStore.getTask(taskId);

        expect(persisted).not.toBeNull();
        expect(persisted?.done).toBe(changedDone);
      } finally {
        if (updateAttempted) {
          // Restore the original sample data.
          const restoreStore = new SupabaseStore(
            supabaseUrl!,
            supabaseKey!
          );

          await restoreStore.updateTask(taskId, {
            done: originalDone,
          });

          const restored = await restoreStore.getTask(taskId);
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
