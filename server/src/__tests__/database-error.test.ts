
import { SupabaseStore } from '../data/supabase-store';
import { DatabaseError } from '../data/database-error';

describe('TP-43: Database failure handling', () => {
  it('converts a Supabase failure into a DatabaseError', async () => {
    const store = new SupabaseStore(
      'https://example.supabase.co',
      'fake-test-key'
    );

    const fakeClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' },
          }),
        }),
      }),
    };

    // Replace the real client with a fake one.
    (store as any).client = fakeClient;

    await expect(store.getSemester()).rejects.toBeInstanceOf(
      DatabaseError
    );
  });
});

describe('TP-43: API database error response', () => {
  it('returns 503 JSON when the database is unavailable', async () => {
    jest.resetModules();

    // Use the same DatabaseError class as the reloaded app.
    const { DatabaseError: MockDatabaseError } =
      require('../data/database-error');

    // Simulate a database failure without using real Supabase.
    jest.doMock('../data/create-store', () => ({
      createStore: () => ({
        getTask: async () => {
          throw new MockDatabaseError('Connection failed');
        },
      }),
    }));

    // Loads the reloaded app, with the failing store, and signs in to it.
    const { signedIn } = require('../testing/session');
    const api = await signedIn();

    const response = await api.get('/tasks/test-task');

    // Check the HTTP status.
    expect(response.status).toBe(503);

    // Check that the API returns a safe JSON error.
    expect(response.body).toEqual({
      error: 'Database unavailable',
    });

    // Confirm the response is JSON.
    expect(response.headers['content-type']).toMatch(/json/);

    // Remove the mock after testing.
    jest.dontMock('../data/create-store');
  });
});
