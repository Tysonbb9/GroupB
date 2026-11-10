import { saveWeeklyCapacity } from './api';
import { wallSemester } from '../testing/fixtures';

/**
 * saveWeeklyCapacity: sending new hours to PATCH /semester (US-32).
 * fetch is replaced here so no server is needed; the server's side is tested
 * in server/src/__tests__/weekly-capacity.test.ts.
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

describe('saveWeeklyCapacity', () => {
  it('returns the hours the server kept', async () => {
    fetchMock.mockResolvedValue(reply({ ...wallSemester, weeklyCapacity: 20 }));
    await expect(saveWeeklyCapacity(20)).resolves.toBe(20);
  });

  it('sends the hours to /semester as a JSON PATCH', async () => {
    fetchMock.mockResolvedValue(reply({ ...wallSemester, weeklyCapacity: 20 }));
    await saveWeeklyCapacity(20);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/semester$/);
    expect(options.method).toBe('PATCH');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ weeklyCapacity: 20 });
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(
      reply({ error: 'weeklyCapacity must be a whole number of hours from 1 to 80' }, 400)
    );
    await expect(saveWeeklyCapacity(81)).rejects.toThrow(
      'weeklyCapacity must be a whole number of hours from 1 to 80'
    );
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(saveWeeklyCapacity(20)).rejects.toThrow(/Could not reach the server/);
  });

  it('rejects a reply that is not a semester', async () => {
    fetchMock.mockResolvedValue(reply({ nope: true }));
    await expect(saveWeeklyCapacity(20)).rejects.toThrow(/invalid semester data/);
  });
});
