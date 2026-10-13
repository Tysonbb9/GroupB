import { wallSemester } from '../testing/fixtures';
import { fetchSemester, resolveBaseUrl } from './api';

/** The few parts of a fetch Response that fetchSemester reads. */
const reply = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('fetchSemester', () => {
  it('returns the semester the server sends', async () => {
    fetchMock.mockResolvedValue(reply(wallSemester));
    await expect(fetchSemester()).resolves.toEqual(wallSemester);
  });

  it('asks the server for /semester', async () => {
    fetchMock.mockResolvedValue(reply(wallSemester));
    await fetchSemester();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/semester$/));
  });

  it('fails with the status when the server answers with an error', async () => {
    fetchMock.mockResolvedValue(reply({ message: 'boom' }, 500));
    await expect(fetchSemester()).rejects.toThrow('The server answered 500');
  });

  it('fails when the data is not shaped like a semester', async () => {
    fetchMock.mockResolvedValue(reply({ label: 'Fall 2026' }));
    await expect(fetchSemester()).rejects.toThrow('invalid semester data');
  });

  it('fails when the server sends something that is not an object at all', async () => {
    fetchMock.mockResolvedValue(reply(null));
    await expect(fetchSemester()).rejects.toThrow('invalid semester data');
  });

  it('names the address it tried when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchSemester()).rejects.toThrow(/Could not reach the server at http/);
  });
});

describe('resolveBaseUrl', () => {
  it('uses the configured address when there is one', () => {
    const url = resolveBaseUrl({
      configured: 'https://api.example.com',
      hostUri: '192.168.1.5:8081',
      isDev: true,
    });
    expect(url).toBe('https://api.example.com');
  });

  it('drops a trailing slash so paths do not get a double slash', () => {
    const url = resolveBaseUrl({ configured: 'https://api.example.com/', hostUri: null, isDev: false });
    expect(url).toBe('https://api.example.com');
  });

  it('in development, reuses the address of the computer running Expo', () => {
    const url = resolveBaseUrl({ configured: undefined, hostUri: '192.168.1.5:8081', isDev: true });
    expect(url).toBe('http://192.168.1.5:3000');
  });

  it('in development with no Expo address, falls back to localhost', () => {
    const url = resolveBaseUrl({ configured: undefined, hostUri: null, isDev: true });
    expect(url).toBe('http://localhost:3000');
  });

  it('treats an empty setting as not set', () => {
    const url = resolveBaseUrl({ configured: '', hostUri: '192.168.1.5:8081', isDev: true });
    expect(url).toBe('http://192.168.1.5:3000');
  });

  it('in a release build, refuses to guess an address', () => {
    expect(() =>
      resolveBaseUrl({ configured: undefined, hostUri: '192.168.1.5:8081', isDev: false })
    ).toThrow('EXPO_PUBLIC_API_URL');
  });
});
