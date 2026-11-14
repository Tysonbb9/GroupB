import { wallSemester } from '../testing/fixtures';
import {
  addReview,
  addTasks,
  extractSyllabusText,
  fetchSemester,
  saveWeeklyCapacity,
  SESSION_ENDED_MESSAGE,
  setRequestAuth,
} from './api';

/**
 * US-20: every request to our server says who is asking, and a 401 means the
 * session has ended (docs/LOGIN_DESIGN.md). These tests cover every route the
 * app calls, so a new one cannot forget the cookie without a test noticing.
 */

const reply = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

const COOKIE = 'better-auth.session_token=abc';
const onPhone = { headers: { Cookie: COOKIE }, credentials: 'omit' as const };

const savedTask = { id: 't1', courseId: 'c1', title: 'Lab report', dueWeek: 3, estimatedHours: 2, done: false };
const savedReview = { id: 'r1', courseId: 'c1', title: 'Lab report', hours: 3, comment: '' };
const syllabus = { text: 'Week 1', pageCount: 1, lineCount: 1, pagesWithoutText: [] };

/** Each route the app calls, with an answer the server would give when it works. */
const routes: [name: string, call: () => Promise<unknown>, success: unknown][] = [
  ['GET /semester', () => fetchSemester(), wallSemester],
  ['PATCH /semester', () => saveWeeklyCapacity(20), { ...wallSemester, weeklyCapacity: 20 }],
  ['POST /syllabus/text', () => extractSyllabusText(new Uint8Array([37, 80, 68, 70])), syllabus],
  [
    'POST /tasks',
    () => addTasks([{ courseId: 'c1', title: 'Lab report', dueWeek: 3, estimatedHours: 2 }]),
    [savedTask],
  ],
  ['POST /courses/:id/reviews', () => addReview('c1', { title: 'Lab report', hours: 3 }), savedReview],
];

let onSessionEnded: jest.Mock;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
  onSessionEnded = jest.fn();
});

afterEach(() => {
  setRequestAuth(null);
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

/** The options fetch was called with, for the one request a test made. */
function sentOptions(): RequestInit & { headers: Record<string, string> } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return fetchMock.mock.calls[0][1];
}

describe.each(routes)('%s with a signed-in student', (_name, call, success) => {
  beforeEach(() => {
    setRequestAuth({ options: async () => onPhone, onSessionEnded });
  });

  it('sends the session cookie, with credentials omitted', async () => {
    fetchMock.mockResolvedValue(reply(success));
    await call();

    expect(sentOptions().headers.Cookie).toBe(COOKIE);
    expect(sentOptions().credentials).toBe('omit');
  });

  it('works as before when the server accepts', async () => {
    fetchMock.mockResolvedValue(reply(success));
    await expect(call()).resolves.toBeDefined();
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it('ends the session on a 401, and says so', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Not signed in' }, 401));

    await expect(call()).rejects.toThrow(SESSION_ENDED_MESSAGE);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403, 404, 500])('does not end the session on a %i', async (status) => {
    fetchMock.mockResolvedValue(reply({ error: 'Something else' }, status));

    // Each route words its refusals in its own way; none of them is "session ended".
    const error: Error = await call().then(
      () => {
        throw new Error('expected the call to fail');
      },
      (refusal: Error) => refusal
    );
    expect(error.message).not.toBe(SESSION_ENDED_MESSAGE);
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it('does not end the session when there is no connection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(call()).rejects.toThrow(/Could not reach the server at http/);
    expect(onSessionEnded).not.toHaveBeenCalled();
  });
});

describe.each(routes)('%s in sample-data mode and in tests (nobody registered)', (_name, call, success) => {
  it('adds no cookie and no credentials', async () => {
    fetchMock.mockResolvedValue(reply(success));
    await call();

    expect(sentOptions().headers.Cookie).toBeUndefined();
    expect(sentOptions().credentials).toBeUndefined();
  });

  it('treats a 401 like any other refusal', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Not signed in' }, 401));
    await expect(call()).rejects.toThrow(/Not signed in|401/);
  });
});

describe('the cookie on each request', () => {
  it('keeps the JSON content type next to the cookie', async () => {
    setRequestAuth({ options: async () => onPhone, onSessionEnded });
    fetchMock.mockResolvedValue(reply([savedTask]));
    await addTasks([{ courseId: 'c1', title: 'Lab report', dueWeek: 3, estimatedHours: 2 }]);

    expect(sentOptions().headers).toEqual({ 'Content-Type': 'application/json', Cookie: COOKIE });
  });

  it('reads the cookie again for every request, so a new sign-in is used straight away', async () => {
    let cookie = 'better-auth.session_token=first';
    setRequestAuth({
      options: async () => ({ headers: { Cookie: cookie }, credentials: 'omit' }),
      onSessionEnded,
    });
    fetchMock.mockResolvedValue(reply(wallSemester));

    await fetchSemester();
    cookie = 'better-auth.session_token=second';
    await fetchSemester();

    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe('better-auth.session_token=first');
    expect(fetchMock.mock.calls[1][1].headers.Cookie).toBe('better-auth.session_token=second');
  });

  it('lets the browser send its own cookie on the web version', async () => {
    setRequestAuth({ options: async () => ({ credentials: 'include' }), onSessionEnded });
    fetchMock.mockResolvedValue(reply(wallSemester));
    await fetchSemester();

    expect(sentOptions().credentials).toBe('include');
    expect(sentOptions().headers.Cookie).toBeUndefined();
  });

  it('stops adding the cookie once the session is cleared', async () => {
    setRequestAuth({ options: async () => onPhone, onSessionEnded });
    setRequestAuth(null);
    fetchMock.mockResolvedValue(reply(wallSemester));
    await fetchSemester();

    expect(sentOptions().headers.Cookie).toBeUndefined();
  });

  it('ends the session only once for one 401', async () => {
    setRequestAuth({ options: async () => onPhone, onSessionEnded });
    fetchMock.mockResolvedValue(reply({}, 401));

    await expect(fetchSemester()).rejects.toThrow(SESSION_ENDED_MESSAGE);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });
});
