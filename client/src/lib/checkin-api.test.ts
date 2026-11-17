import { answerCheckin, fetchCheckinQuestion } from './api';

/**
 * #155: fetchCheckinQuestion and answerCheckin. fetch is replaced here so no
 * server is needed; the server's side is in server/src/__tests__/checkin-routes.test.ts.
 */

const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
  }) as Response;

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const question = { courseId: 'c1', code: 'CS 262', text: 'Is CS 262 still on schedule?', reason: null };

describe('fetchCheckinQuestion', () => {
  it('returns the question the server chose', async () => {
    fetchMock.mockResolvedValue(reply({ question }));
    await expect(fetchCheckinQuestion()).resolves.toEqual(question);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/checkin$/);
  });

  it('returns null when there is nothing to ask', async () => {
    fetchMock.mockResolvedValue(reply({ question: null }));
    await expect(fetchCheckinQuestion()).resolves.toBeNull();
  });

  it('rejects a reply that is not a question', async () => {
    fetchMock.mockResolvedValue(reply({ question: { nope: true } }));
    await expect(fetchCheckinQuestion()).rejects.toThrow(/not a check-in question/);
  });
});

describe('answerCheckin', () => {
  it('posts "Yes" as JSON, with no changes', async () => {
    fetchMock.mockResolvedValue(reply({ checkin: {}, tasks: [] }));
    await expect(answerCheckin('c1', 'on-schedule')).resolves.toEqual([]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/checkin$/);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ courseId: 'c1', answer: 'on-schedule' });
  });

  it('posts the changes with "changed" and returns the saved tasks', async () => {
    const saved = [{ id: 'post', courseId: 'c1', title: 'Discussion post', dueWeek: 3, estimatedHours: 4, done: false }];
    fetchMock.mockResolvedValue(reply({ checkin: {}, tasks: saved }));
    const changes = [{ taskId: 'post', dueWeek: 3, estimatedHours: 4 }];

    await expect(answerCheckin('c1', 'changed', changes)).resolves.toEqual(saved);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ courseId: 'c1', answer: 'changed', changes });
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Course not found' }, 404));
    await expect(answerCheckin('nope', 'on-schedule')).rejects.toThrow('Course not found');
  });
});
