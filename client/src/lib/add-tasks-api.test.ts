import { addTasks, NewTask } from './api';

/**
 * addTasks: sending the reviewed assignments to POST /tasks (US-30).
 * fetch is replaced here so no server is needed; the server's side is tested
 * in server/src/__tests__/add-tasks.test.ts.
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

const labReport: NewTask = { courseId: 'c1', title: 'Lab report', dueWeek: 4, estimatedHours: 3 };
const saved = [{ ...labReport, id: 'c1-syl-1', done: false }];

describe('addTasks', () => {
  it('returns the tasks the server saved, with their ids', async () => {
    fetchMock.mockResolvedValue(reply(saved, 201));
    await expect(addTasks([labReport])).resolves.toEqual(saved);
  });

  it('posts the tasks to /tasks as JSON', async () => {
    fetchMock.mockResolvedValue(reply(saved, 201));
    await addTasks([labReport]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/tasks$/);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ tasks: [labReport] });
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Task 1: dueWeek must be a whole number from 1 to 15' }, 400));
    await expect(addTasks([labReport])).rejects.toThrow('Task 1: dueWeek must be a whole number from 1 to 15');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(addTasks([labReport])).rejects.toThrow(/Could not reach the server/);
  });

  it('rejects a reply that is not a list', async () => {
    fetchMock.mockResolvedValue(reply({ nope: true }, 201));
    await expect(addTasks([labReport])).rejects.toThrow(/not a list/);
  });
});