import { getAiStatus, readSyllabusWithAi } from './api';

/**
 * getAiStatus and readSyllabusWithAi (issue #145): asking the server whether
 * it has an AI, and having it read a syllabus. fetch is replaced here, so no
 * server is needed; the server's side is tested in server/src/__tests__/.
 */

/** The parts of a fetch Response these functions read. */
const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
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

const READING = {
  assignments: [{ title: 'Prototype demo', dueWeek: 4, estimatedHours: 6 }, { title: 'Quizzes', dueWeek: null, estimatedHours: null }],
  weights: [{ label: 'Exams', percent: 30 }],
  policies: { absencesAllowed: 4, dropRule: 'Lowest quiz dropped' },
  dropped: 0,
};

describe('getAiStatus', () => {
  it('asks GET /ai/status and is true when the server says available', async () => {
    fetchMock.mockResolvedValue(reply({ available: true }));

    await expect(getAiStatus()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/ai\/status$/);
  });

  it('is false when the server says it has none', async () => {
    fetchMock.mockResolvedValue(reply({ available: false }));
    await expect(getAiStatus()).resolves.toBe(false);
  });

  it.each([
    ['an error status', () => fetchMock.mockResolvedValue(reply({ error: 'x' }, 404))],
    ['an answer that is not the right shape', () => fetchMock.mockResolvedValue(reply({ ok: true }))],
    ['an answer that is not JSON', () => fetchMock.mockResolvedValue(reply(new Error('bad json')))],
    ['no server at all', () => fetchMock.mockRejectedValue(new TypeError('Network request failed'))],
  ])('is false, and never throws, for %s', async (_name, arrange) => {
    arrange();
    await expect(getAiStatus()).resolves.toBe(false);
  });
});

describe('readSyllabusWithAi', () => {
  it('posts the text as JSON to /ai/syllabus and returns the reading', async () => {
    fetchMock.mockResolvedValue(reply(READING));

    await expect(readSyllabusWithAi('Week 4: Prototype demo')).resolves.toEqual(READING);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/ai\/syllabus$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ text: 'Week 4: Prototype demo' });
  });

  it('passes on the server\'s own message when it refuses', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'The AI service could not be reached. Try again in a moment.' }, 502));

    await expect(readSyllabusWithAi('x')).rejects.toThrow('The AI service could not be reached. Try again in a moment.');
  });

  it('says what the status was when the server sent no message', async () => {
    fetchMock.mockResolvedValue(reply(new Error('no body'), 500));
    await expect(readSyllabusWithAi('x')).rejects.toThrow('The server answered 500');
  });

  it.each([
    ['a week that is text', { ...READING, assignments: [{ title: 'Lab', dueWeek: '4', estimatedHours: null }] }],
    ['no title', { ...READING, assignments: [{ dueWeek: 4, estimatedHours: null }] }],
    ['no weights list', { ...READING, weights: undefined }],
    ['no policies', { ...READING, policies: undefined }],
    ['an empty object', {}],
    ['a list', []],
  ])('rejects an answer with %s', async (_name, body) => {
    fetchMock.mockResolvedValue(reply(body));
    await expect(readSyllabusWithAi('x')).rejects.toThrow('The server sent an invalid reading');
  });

  it('says plainly when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(readSyllabusWithAi('x')).rejects.toThrow(/Could not reach the server/);
  });
});
