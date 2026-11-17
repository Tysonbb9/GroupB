import { updateTask } from './api';

/**
 * updateTask: sending a task's new hours to PATCH /tasks/:id (US-44).
 * fetch is replaced here so no server is needed; the server's side of the
 * route is tested in server/src/__tests__.
 */

const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
  }) as Response;

const midterm = { id: 'exam', courseId: 'c2', title: 'Midterm', dueWeek: 6, estimatedHours: 12, done: false };

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('updateTask', () => {
  it('returns the task as the server now holds it', async () => {
    fetchMock.mockResolvedValue(reply(midterm));
    await expect(updateTask('exam', { estimatedHours: 12 })).resolves.toEqual(midterm);
  });

  it('sends only the hours, as a JSON PATCH to the task', async () => {
    fetchMock.mockResolvedValue(reply(midterm));
    await updateTask('exam', { estimatedHours: 12 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/tasks\/exam$/);
    expect(options.method).toBe('PATCH');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ estimatedHours: 12 });
  });

  it('sends a new due week (US-44)', async () => {
    fetchMock.mockResolvedValue(reply({ ...midterm, dueWeek: 7 }));
    await expect(updateTask('exam', { dueWeek: 7 })).resolves.toMatchObject({ dueWeek: 7 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ dueWeek: 7 });
  });

  it('rejects a reply with no title or due week', async () => {
    fetchMock.mockResolvedValue(reply({ id: 'exam', estimatedHours: 3 }));
    await expect(updateTask('exam', { estimatedHours: 3 })).rejects.toThrow('The server sent invalid task data');
  });

  it('can clear the hours with null', async () => {
    fetchMock.mockResolvedValue(reply({ ...midterm, estimatedHours: null }));
    await expect(updateTask('exam', { estimatedHours: null })).resolves.toMatchObject({ estimatedHours: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ estimatedHours: null });
  });

  it('keeps an id with odd characters inside its part of the address', async () => {
    fetchMock.mockResolvedValue(reply({ ...midterm, id: 'a/b?c' }));
    await updateTask('a/b?c', { estimatedHours: 3 });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/tasks\/a%2Fb%3Fc$/);
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(
      reply({ error: 'estimatedHours must be a number more than 0 and up to 100, or null' }, 400)
    );
    await expect(updateTask('exam', { estimatedHours: 101 })).rejects.toThrow(
      'estimatedHours must be a number more than 0 and up to 100, or null'
    );
  });

  it('says so when the task is not found', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Task not found' }, 404));
    await expect(updateTask('nope', { estimatedHours: 3 })).rejects.toThrow('Task not found');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(updateTask('exam', { estimatedHours: 3 })).rejects.toThrow(/Could not reach the server/);
  });

  it('rejects a reply that is not a task', async () => {
    fetchMock.mockResolvedValue(reply({ hello: 'world' }));
    await expect(updateTask('exam', { estimatedHours: 3 })).rejects.toThrow('The server sent invalid task data');
  });

  it('rejects a reply about a different task', async () => {
    fetchMock.mockResolvedValue(reply({ ...midterm, id: 'other' }));
    await expect(updateTask('exam', { estimatedHours: 12 })).rejects.toThrow('The server sent invalid task data');
  });

  it('rejects a reply whose hours are not a number', async () => {
    fetchMock.mockResolvedValue(reply({ ...midterm, estimatedHours: '12' }));
    await expect(updateTask('exam', { estimatedHours: 12 })).rejects.toThrow('The server sent invalid task data');
  });
});
