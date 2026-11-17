import { addCalendarEvents, fetchCalendarEvents, fetchCalendarLinkStatus, saveCalendarLink } from './api';

/**
 * The calendar link calls (US-48, #164). fetch is replaced so no server is
 * needed; the routes are tested in server/src/__tests__/calendar-routes.test.ts.
 */

const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
  }) as Response;

const LINK = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=1&authtoken=secret-token';

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('fetchCalendarLinkStatus', () => {
  it('asks GET /calendar/link and returns whether a link is saved', async () => {
    fetchMock.mockResolvedValue(reply({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' }));
    await expect(fetchCalendarLinkStatus()).resolves.toEqual({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/calendar\/link$/);
  });

  it('rejects a reply that is not a status', async () => {
    fetchMock.mockResolvedValue(reply({ saved: 'yes' }));
    await expect(fetchCalendarLinkStatus()).rejects.toThrow('The server sent an invalid calendar link status');
  });
});

describe('saveCalendarLink', () => {
  it('posts the link as JSON and returns the new status', async () => {
    fetchMock.mockResolvedValue(reply({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' }));
    await expect(saveCalendarLink(LINK)).resolves.toMatchObject({ saved: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/calendar\/link$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ url: LINK });
  });

  it.each([
    [400, 'The link must be a calendar link from moodle.calvin.edu.'],
    [422, 'That link did not give a calendar. In Moodle, use Export calendar, then Get calendar URL.'],
    [502, 'Moodle could not be reached. Try again in a moment.'],
  ])("passes the server's %i message on", async (status, error) => {
    fetchMock.mockResolvedValue(reply({ error }, status));
    await expect(saveCalendarLink(LINK)).rejects.toThrow(error);
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(saveCalendarLink(LINK)).rejects.toThrow(/Could not reach the server/);
  });

  it('rejects a reply that is not a status', async () => {
    fetchMock.mockResolvedValue(reply({ ok: 1 }));
    await expect(saveCalendarLink(LINK)).rejects.toThrow('The server sent an invalid calendar link status');
  });
});

describe('fetchCalendarEvents (US-49)', () => {
  const proposals = {
    proposals: [{ eventId: 'e1', title: 'Lab 9', dueWeek: 4, courseId: 'cs262', alreadyInSemester: false }],
    alreadyAdded: 1,
    outsideSemester: 0,
  };

  it('asks GET /calendar/events and returns the proposals', async () => {
    fetchMock.mockResolvedValue(reply(proposals));
    await expect(fetchCalendarEvents()).resolves.toEqual(proposals);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/calendar\/events$/);
  });

  it("passes the server's message on, such as no saved link", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Save your Moodle calendar link first.' }, 409));
    await expect(fetchCalendarEvents()).rejects.toThrow('Save your Moodle calendar link first.');
  });

  it.each([
    ['not an object', 'hello'],
    ['missing the counts', { proposals: [] }],
    ['a proposal without a week', { ...proposals, proposals: [{ eventId: 'e1', title: 'x', courseId: null }] }],
  ])('rejects a reply that is %s', async (_case, body) => {
    fetchMock.mockResolvedValue(reply(body));
    await expect(fetchCalendarEvents()).rejects.toThrow('The server sent something that is not a list of calendar events');
  });
});

describe('addCalendarEvents (US-49)', () => {
  const task = { eventId: 'e1', courseId: 'cs262', title: 'Lab 9', dueWeek: 4, estimatedHours: null };

  it('posts the kept events as JSON and returns the tasks with their ids', async () => {
    const saved = [{ id: 'cs262-syl-1', courseId: 'cs262', title: 'Lab 9', dueWeek: 4, estimatedHours: null, done: false }];
    fetchMock.mockResolvedValue(reply({ tasks: saved }, 201));
    await expect(addCalendarEvents([task])).resolves.toEqual(saved);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/calendar\/events$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ tasks: [task] });
  });

  it("passes the server's message on", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Task 1: that calendar event was already added' }, 409));
    await expect(addCalendarEvents([task])).rejects.toThrow('Task 1: that calendar event was already added');
  });

  it('rejects a reply that is not a list of tasks', async () => {
    fetchMock.mockResolvedValue(reply({ ok: 1 }, 201));
    await expect(addCalendarEvents([task])).rejects.toThrow('The server sent something that is not a list of tasks');
  });
});
