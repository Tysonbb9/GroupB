import { addReview } from './api';

/**
 * addReview: storing how long a finished assignment took (US-23).
 * fetch is replaced here so no server is needed; the server's side is tested
 * in server/src/__tests__/reviews.test.ts.
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

const saved = { id: 'review-1', courseId: 'c1', title: 'Lab report', hours: 3, comment: '' };

describe('addReview', () => {
  it('returns the review the server stored, with its id', async () => {
    fetchMock.mockResolvedValue(reply(saved, 201));
    await expect(addReview('c1', { title: 'Lab report', hours: 3 })).resolves.toEqual(saved);
  });

  it("posts the review to the course's /reviews as JSON", async () => {
    fetchMock.mockResolvedValue(reply(saved, 201));
    await addReview('c1', { title: 'Lab report', hours: 3 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/courses\/c1\/reviews$/);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ title: 'Lab report', hours: 3 });
  });

  it("passes the server's message on when it refuses", async () => {
    fetchMock.mockResolvedValue(reply({ error: 'Course not found' }, 404));
    await expect(addReview('nope', { title: 'Lab report', hours: 3 })).rejects.toThrow('Course not found');
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(addReview('c1', { title: 'Lab report', hours: 3 })).rejects.toThrow(/Could not reach the server/);
  });

  it('rejects a reply that is not a review', async () => {
    fetchMock.mockResolvedValue(reply({ nope: true }, 201));
    await expect(addReview('c1', { title: 'Lab report', hours: 3 })).rejects.toThrow(/not a review/);
  });
});
