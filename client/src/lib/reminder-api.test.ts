import { fetchReminder } from './api';

/**
 * fetchReminder: POST /reminders (#156). fetch is replaced so no server is
 * needed; the route and its limits are tested in server/src/__tests__.
 */

const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
  }) as Response;

const reminder = {
  taskId: 'm-1',
  courseId: 'math251',
  code: 'MATH 251',
  title: 'Problem set 1',
  text: 'Finish it this week: 3 hours, due week 3.',
  countToday: 1,
  maxPerDay: 2,
};

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('fetchReminder', () => {
  it('returns the reminder the server gave', async () => {
    fetchMock.mockResolvedValue(reply({ reminder }));
    await expect(fetchReminder()).resolves.toEqual(reminder);
  });

  it('asks with a POST to /reminders, since the server records it', async () => {
    fetchMock.mockResolvedValue(reply({ reminder: null }));
    await fetchReminder();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/reminders$/);
    expect(options.method).toBe('POST');
  });

  it('returns null when there is none', async () => {
    fetchMock.mockResolvedValue(reply({ reminder: null }));
    await expect(fetchReminder()).resolves.toBeNull();
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Sign in first' }, 401));
    await expect(fetchReminder()).rejects.toThrow();
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchReminder()).rejects.toThrow(/Could not reach the server/);
  });

  it.each([
    ['not an object', 'hello'],
    ['missing the reminder field', { other: 1 }],
    ['a reminder without its text', { reminder: { ...reminder, text: undefined } }],
    ['a count that is not a number', { reminder: { ...reminder, countToday: '1' } }],
  ])('rejects a reply that is %s', async (_case, body) => {
    fetchMock.mockResolvedValue(reply(body));
    await expect(fetchReminder()).rejects.toThrow('The server sent something that is not a reminder');
  });
});
