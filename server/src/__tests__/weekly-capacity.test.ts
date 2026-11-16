import { resetDb } from '../data/db';
import { DatabaseError } from '../data/database-error';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';
import { withSample, signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn(); // every route outside /api/auth needs a session
});

/**
 * US-32: the student changes how many hours they have each week, and the
 * server keeps it. Test plan row TP-36.
 */

beforeEach(async () => { resetDb(); await withSample(api); });

/** The capacity a fresh GET /semester reports, so a test sees what was kept. */
async function capacityNow(): Promise<number> {
  const res = await api.get('/semester');
  return res.body.weeklyCapacity;
}

describe('TP-36: PATCH /semester sets the weekly capacity', () => {
  it('saves new hours and returns the whole semester with them', async () => {
    const res = await api.patch('/semester').send({ weeklyCapacity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.weeklyCapacity).toBe(20);
    expect(res.body.label).toBe('Fall 2026');
    expect(res.body.tasks).toHaveLength(36);
  });

  it('keeps the new hours for the next request', async () => {
    await api.patch('/semester').send({ weeklyCapacity: 20 });
    expect(await capacityNow()).toBe(20);
  });

  it.each([1, 80])('accepts %i hours, the edge of the range', async (hours) => {
    const res = await api.patch('/semester').send({ weeklyCapacity: hours });

    expect(res.status).toBe(200);
    expect(res.body.weeklyCapacity).toBe(hours);
  });

  it.each([
    ['missing', {}],
    ['zero', { weeklyCapacity: 0 }],
    ['negative', { weeklyCapacity: -5 }],
    ['over 80', { weeklyCapacity: 81 }],
    ['not a whole number', { weeklyCapacity: 12.5 }],
    ['text', { weeklyCapacity: '20' }],
    ['null', { weeklyCapacity: null }],
  ])('refuses hours that are %s, and changes nothing', async (_case, body) => {
    const res = await api.patch('/semester').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'weeklyCapacity must be a whole number of hours from 1 to 80',
    });
    expect(await capacityNow()).toBe(15);
  });
});

describe('TP-36: the in-memory store keeps the capacity', () => {
  it('returns the new capacity when the semester is read again', async () => {
    await new MemoryStore().updateSemester('student-a', { weeklyCapacity: 22 });
    const semester = await new MemoryStore().getSemester('student-a');
    expect(semester.weeklyCapacity).toBe(22);
  });

  it('changes nothing when there is nothing to change', async () => {
    const semester = await new MemoryStore().updateSemester('student-a', {});
    expect(semester.weeklyCapacity).toBe(15);
  });
});

describe('TP-36: the Supabase store updates student settings', () => {
  function storeWithFakeDatabase(updateError: { message: string } | null) {
    const upsert = jest.fn().mockResolvedValue({ error: updateError });
    const client = { from: jest.fn().mockReturnValue({ upsert }) };
    const store = new SupabaseStore('https://example.supabase.co', 'fake-test-key');
    (store as unknown as { client: unknown }).client = client;
    return { store, client, upsert };
  }

  it('upserts weekly capacity by student, never on the shared semester', async () => {
    const { store, client, upsert } = storeWithFakeDatabase(null);
    const saved = { label: 'Fall 2026', currentWeek: 3, weeklyCapacity: 20, courses: [], tasks: [] };
    jest.spyOn(store, 'getSemester').mockResolvedValue(saved);
    await expect(store.updateSemester('student-a', { weeklyCapacity: 20 })).resolves.toEqual(saved);
    expect(client.from).toHaveBeenCalledWith('student_settings');
    expect(upsert).toHaveBeenCalledWith({ user_id: 'student-a', weekly_capacity: 20 }, { onConflict: 'user_id' });
    expect(store.getSemester).toHaveBeenCalledWith('student-a');
  });

  it('turns a failed update into a DatabaseError', async () => {
    const { store } = storeWithFakeDatabase({ message: 'Connection failed' });
    await expect(store.updateSemester('student-a', { weeklyCapacity: 20 })).rejects.toBeInstanceOf(DatabaseError);
  });
});

// Against a real Supabase project, only when its keys are set and write tests
// are switched on, like TP-41. It puts the original capacity back afterwards.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabaseStudent = process.env.SUPABASE_TEST_USER_ID;
const runSupabaseWrite =
  supabaseUrl && supabaseKey && supabaseStudent && process.env.RUN_SUPABASE_WRITE_TESTS === 'true' ? it : it.skip;

describe('TP-36: Supabase keeps the capacity across store instances', () => {
  runSupabaseWrite(
    'reads back the new capacity from a fresh store',
    async () => {
      const original = (await new SupabaseStore(supabaseUrl!, supabaseKey!).getSemester(supabaseStudent!)).weeklyCapacity;
      const changed = original === 20 ? 21 : 20;

      try {
        await new SupabaseStore(supabaseUrl!, supabaseKey!).updateSemester(supabaseStudent!, { weeklyCapacity: changed });
        const fresh = await new SupabaseStore(supabaseUrl!, supabaseKey!).getSemester(supabaseStudent!);
        expect(fresh.weeklyCapacity).toBe(changed);
      } finally {
        await new SupabaseStore(supabaseUrl!, supabaseKey!).updateSemester(supabaseStudent!, { weeklyCapacity: original });
      }
    },
    30000
  );
});
