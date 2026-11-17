import { saveWeekHours } from './api';

/**
 * saveWeekHours: one week's own hours to PATCH /semester/weeks/:week (#148).
 * fetch is replaced so no server is needed; the route itself is tested in
 * server/src/__tests__/week-hours.test.ts.
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

describe('saveWeekHours', () => {
  it('returns every week the server holds with its own hours', async () => {
    fetchMock.mockResolvedValue(reply([{ week: 2, hours: 5 }, { week: 6, hours: 25 }]));
    await expect(saveWeekHours(6, 25)).resolves.toEqual([
      { week: 2, hours: 5 },
      { week: 6, hours: 25 },
    ]);
  });

  it('sends the hours as a JSON PATCH to that week', async () => {
    fetchMock.mockResolvedValue(reply([{ week: 6, hours: 25 }]));
    await saveWeekHours(6, 25);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/semester\/weeks\/6$/);
    expect(options.method).toBe('PATCH');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ hours: 25 });
  });

  it('sends null to clear a week', async () => {
    fetchMock.mockResolvedValue(reply([]));
    await expect(saveWeekHours(6, null)).resolves.toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ hours: null });
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'hours must be a whole number of hours from 1 to 80, or null' }, 400));
    await expect(saveWeekHours(6, 81)).rejects.toThrow('hours must be a whole number of hours from 1 to 80, or null');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(saveWeekHours(6, 25)).rejects.toThrow(/Could not reach the server/);
  });

  it.each([
    ['not a list', { week: 6, hours: 25 }],
    ['a week without hours', [{ week: 6 }]],
    ['hours as text', [{ week: 6, hours: '25' }]],
  ])('rejects a reply that is %s', async (_case, body) => {
    fetchMock.mockResolvedValue(reply(body));
    await expect(saveWeekHours(6, 25)).rejects.toThrow('The server sent invalid week hours');
  });
});
