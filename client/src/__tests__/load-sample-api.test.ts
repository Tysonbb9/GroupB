import { loadSampleSemester, setRequestAuth, SESSION_ENDED_MESSAGE } from '../lib/api';
import { wallSemester } from '../testing/fixtures';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => { globalThis.fetch = mockFetch; mockFetch.mockReset(); setRequestAuth(null); });
afterAll(() => { globalThis.fetch = originalFetch; setRequestAuth(null); });

it('posts without a body and returns the whole sample semester', async () => {
  mockFetch.mockResolvedValue(reply(201, wallSemester));
  await expect(loadSampleSemester()).resolves.toEqual(wallSemester);
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/semester/sample'), expect.objectContaining({ method: 'POST' }));
  expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
});
it('refetches the existing semester after a conflict', async () => {
  mockFetch.mockResolvedValueOnce(reply(409, { error: 'Already has data' })).mockResolvedValueOnce(reply(200, wallSemester));
  await expect(loadSampleSemester()).resolves.toEqual(wallSemester);
  expect(mockFetch.mock.calls[1][0]).toMatch(/\/semester$/);
});
it('keeps the server refusal message', async () => {
  mockFetch.mockResolvedValue(reply(503, { error: 'Please try again later.' }));
  await expect(loadSampleSemester()).rejects.toThrow('Please try again later.');
});
it('rejects invalid semester data', async () => {
  mockFetch.mockResolvedValue(reply(201, {}));
  await expect(loadSampleSemester()).rejects.toThrow('invalid semester data');
});
it('ends an expired session', async () => {
  const onSessionEnded = jest.fn();
  setRequestAuth({ options: async () => ({ credentials: 'include' }), onSessionEnded });
  mockFetch.mockResolvedValue(reply(401, {}));
  await expect(loadSampleSemester()).rejects.toThrow(SESSION_ENDED_MESSAGE);
  expect(onSessionEnded).toHaveBeenCalledTimes(1);
  setRequestAuth(null);
});
