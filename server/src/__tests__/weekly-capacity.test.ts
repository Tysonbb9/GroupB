import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';
import { DatabaseError } from '../data/database-error';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';

/**
 * US-32: the student changes how many hours they have each week, and the
 * server keeps it. Test plan row TP-36.
 */

beforeEach(() => resetDb());

/** The capacity a fresh GET /semester reports, so a test sees what was kept. */
async function capacityNow(): Promise<number> {
  const res = await request(app).get('/semester');
  return res.body.weeklyCapacity;
}

describe('TP-36: PATCH /semester sets the weekly capacity', () => {
  it('saves new hours and returns the whole semester with them', async () => {
    const res = await request(app).patch('/semester').send({ weeklyCapacity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.weeklyCapacity).toBe(20);
    expect(res.body.label).toBe('Fall 2026');
    expect(res.body.tasks).toHaveLength(36);
  });

  it('keeps the new hours for the next request', async () => {
    await request(app).patch('/semester').send({ weeklyCapacity: 20 });
    expect(await capacityNow()).toBe(20);
  });

  it.each([1, 80])('accepts %i hours, the edge of the range', async (hours) => {
    const res = await request(app).patch('/semester').send({ weeklyCapacity: hours });

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
    const res = await request(app).patch('/semester').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'weeklyCapacity must be a whole number of hours from 1 to 80',
    });
    expect(await capacityNow()).toBe(15);
  });
});

describe('TP-36: the in-memory store keeps the capacity', () => {
  it('returns the new capacity when the semester is read again', async () => {
    await new MemoryStore().updateSemester({ weeklyCapacity: 22 });
    const semester = await new MemoryStore().getSemester();
    expect(semester.weeklyCapacity).toBe(22);
  });

  it('changes nothing when there is nothing to change', async () => {
    const semester = await new MemoryStore().updateSemester({});
    expect(semester.weeklyCapacity).toBe(15);
  });
});

describe('TP-36: the Supabase store updates the one semester row', () => {
  /** A SupabaseStore whose database is a stand-in, so no real project is needed. */
  function storeWithFakeDatabase(updateError: { message: string } | null) {
    const eq = jest.fn().mockResolvedValue({ error: updateError });
    const update = jest.fn().mockReturnValue({ eq });
    const single = jest.fn().mockResolvedValue({
      data: { id: 'fall-2026', label: 'Fall 2026', current_week: 3, weekly_capacity: 15 },
      error: null,
    });
    const client = { from: jest.fn().mockReturnValue({ select: () => ({ single }), update }) };

    const store = new SupabaseStore('https://example.supabase.co', 'fake-test-key');
    (store as unknown as { client: unknown }).client = client;
    return { store, client, update, eq };
  }

  it('sets weekly_capacity on the row, found by its id', async () => {
    const { store, client, update, eq } = storeWithFakeDatabase(null);
    const saved = { label: 'Fall 2026', currentWeek: 3, weeklyCapacity: 20, courses: [], tasks: [] };
    jest.spyOn(store, 'getSemester').mockResolvedValue(saved);

    await expect(store.updateSemester({ weeklyCapacity: 20 })).resolves.toEqual(saved);
    expect(client.from).toHaveBeenCalledWith('semester');
    expect(update).toHaveBeenCalledWith({ weekly_capacity: 20 });
    expect(eq).toHaveBeenCalledWith('id', 'fall-2026');
  });

  it('turns a failed update into a DatabaseError', async () => {
    const { store } = storeWithFakeDatabase({ message: 'Connection failed' });
    await expect(store.updateSemester({ weeklyCapacity: 20 })).rejects.toBeInstanceOf(DatabaseError);
  });
});

// Against a real Supabase project, only when its keys are set and write tests
// are switched on, like TP-41. It puts the original capacity back afterwards.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const runSupabaseWrite =
  supabaseUrl && supabaseKey && process.env.RUN_SUPABASE_WRITE_TESTS === 'true' ? it : it.skip;

describe('TP-36: Supabase keeps the capacity across store instances', () => {
  runSupabaseWrite(
    'reads back the new capacity from a fresh store',
    async () => {
      const original = (await new SupabaseStore(supabaseUrl!, supabaseKey!).getSemester()).weeklyCapacity;
      const changed = original === 20 ? 21 : 20;

      try {
        await new SupabaseStore(supabaseUrl!, supabaseKey!).updateSemester({ weeklyCapacity: changed });
        const fresh = await new SupabaseStore(supabaseUrl!, supabaseKey!).getSemester();
        expect(fresh.weeklyCapacity).toBe(changed);
      } finally {
        await new SupabaseStore(supabaseUrl!, supabaseKey!).updateSemester({ weeklyCapacity: original });
      }
    },
    30000
  );
});
