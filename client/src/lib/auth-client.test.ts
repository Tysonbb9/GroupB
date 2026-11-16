import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAppAuth, createCrunchWeekAuthClient, serverAuth, SessionStorage } from './auth-client';
import { createServerAuth } from './auth';
import { fetchSemester, setRequestAuth } from './api';
import { wallSemester } from '../testing/fixtures';

/**
 * These tests run the phone's real Better Auth client against a real Better
 * Auth server (the version docs/LOGIN_DESIGN.md names), kept in memory, so
 * the answers the app is built on are checked, not assumed. Only the
 * network and SecureStore are stood in for.
 */

// The Expo plugin asks expo-linking for the app's address, which needs a built app.
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `crunchweek://${path.replace(/^\//, '')}`,
}));

// @better-auth/expo/dist/client.js imports constants/linking and dynamically loads
// network in ExpoOnlineManager.setup during session updates. Our storage uses SecureStore.
// Resolve each peer explicitly: mocked native APIs do not test whether it is installed.
const installedPackages = require as typeof require & { resolve: (name: string) => string };
describe('the phone authentication dependencies', () => {
  it.each(['expo-constants', 'expo-linking', 'expo-network', 'expo-secure-store'])(
    'installs %s for the real phone client', (name) => {
      expect(() => installedPackages.resolve(name)).not.toThrow();
    }
  );
});

const SERVER = 'http://server.test';

/** SecureStore, kept in a Map. */
function memoryStorage(): SessionStorage & { saved: Map<string, string> } {
  const saved = new Map<string, string>();
  return {
    saved,
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => {
      saved.set(key, value);
    },
    getItemAsync: async (key) => saved.get(key) ?? null,
    setItemAsync: async (key, value) => {
      saved.set(key, value);
    },
  };
}

/** A Better Auth server set up as the login design says, with nothing in it yet. */
function startServer() {
  return betterAuth({
    baseURL: SERVER,
    secret: 'a-test-secret-that-is-long-enough-to-sign-sessions',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustedOrigins: ['crunchweek://'],
    logger: { disabled: true },
  });
}

function setUp() {
  const server = startServer();
  const storage = memoryStorage();
  let online = true;
  const requests: Request[] = [];
  const network = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError('Network request failed');
    const request = new Request(input, init);
    requests.push(request.clone());
    return server.handler(request);
  };
  const client = createCrunchWeekAuthClient(SERVER, storage, network);
  const auth = createServerAuth(client, { serverAddress: SERVER, isWeb: false });
  return {
    server,
    storage,
    client,
    auth,
    requests,
    goOffline: () => {
      online = false;
    },
  };
}

/** Asks the real server whose session a cookie belongs to. */
async function whoseSession(server: ReturnType<typeof startServer>, cookie: string) {
  const session = await server.api.getSession({ headers: new Headers({ cookie }) });
  return session?.user.email ?? null;
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('the routes in docs/LOGIN_DESIGN.md, against real Better Auth', () => {
  it('signs up a new student, who is then signed in', async () => {
    const { auth } = setUp();
    await expect(auth.signUp('Sam Student', 'sam@example.edu', 'password-123')).resolves.toEqual({
      ok: true,
      email: 'sam@example.edu',
    });
  });

  it('lets a student who signed up sign in again later', async () => {
    const { auth } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    await auth.signOut();

    await expect(auth.signIn('sam@example.edu', 'password-123')).resolves.toEqual({
      ok: true,
      email: 'sam@example.edu',
    });
  });

  it('refuses a wrong password (401) with the server message', async () => {
    const { auth } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    await auth.signOut();

    await expect(auth.signIn('sam@example.edu', 'wrong-password')).resolves.toEqual({
      ok: false,
      message: 'Invalid email or password',
    });
  });

  it('refuses an email nobody has signed up with, with the same message', async () => {
    const { auth } = setUp();
    await expect(auth.signIn('nobody@example.edu', 'password-123')).resolves.toEqual({
      ok: false,
      message: 'Invalid email or password',
    });
  });

  it('refuses an email that is already used (422)', async () => {
    const { auth } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    const result = await auth.signUp('Another Sam', 'sam@example.edu', 'password-456');
    expect(result).toEqual({ ok: false, message: 'User already exists. Use another email.' });
  });

  it('refuses a password under 8 characters (400)', async () => {
    const { auth } = setUp();
    await expect(auth.signUp('Sam Student', 'sam@example.edu', 'short')).resolves.toEqual({
      ok: false,
      message: 'Password too short',
    });
  });

  it('accepts a password of exactly 8 characters', async () => {
    const { auth } = setUp();
    await expect(auth.signUp('Sam Student', 'sam@example.edu', '12345678')).resolves.toEqual({
      ok: true,
      email: 'sam@example.edu',
    });
  });

  it('a wrong password does not sign in, even after an earlier student signed in', async () => {
    const { auth, client } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    await auth.signOut();
    await auth.signIn('sam@example.edu', 'wrong-password');

    expect(await client.getCookie()).toBe('');
  });
});

describe('the session on the phone', () => {
  it('saves the session cookie under the crunchweek prefix', async () => {
    const { auth, storage } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    expect(storage.saved.get('crunchweek_cookie')).toMatch(/session_token/);
  });

  it('hands back a cookie the server recognises as this student', async () => {
    const { auth, client, server } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    await expect(whoseSession(server, await client.getCookie())).resolves.toBe('sam@example.edu');
  });

  it('sends that cookie on our own requests, with credentials omitted', async () => {
    const { auth, server } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    const options = await auth.requestOptions();
    expect(options.credentials).toBe('omit');
    const cookie = (options.headers as Record<string, string>).Cookie;
    await expect(whoseSession(server, cookie)).resolves.toBe('sam@example.edu');
  });

  it('survives the app closing: a new client on the same phone is still signed in', async () => {
    const { auth, server, storage } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    // Opening the app again makes a fresh client, reading the same SecureStore.
    const reopened = createCrunchWeekAuthClient(SERVER, storage, (input, init) =>
      server.handler(new Request(input, init))
    );
    const again = createServerAuth(reopened, { serverAddress: SERVER, isWeb: false });
    await expect(again.restore?.()).resolves.toEqual({ email: 'sam@example.edu' });
  });

  it('opens on Log in when nobody has signed in on this phone', async () => {
    const { auth } = setUp();
    await expect(auth.restore?.()).resolves.toBeNull();
  });

  it('keeps a signed-in student signed in when the app opens with no connection', async () => {
    const { auth, goOffline } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    goOffline();

    await expect(auth.restore?.()).resolves.toEqual({ email: null });
  });

  it('says it cannot reach the server when signing in with no connection', async () => {
    const { auth, goOffline } = setUp();
    goOffline();

    await expect(auth.signIn('sam@example.edu', 'password-123')).resolves.toEqual({
      ok: false,
      message: `Could not reach the server at ${SERVER}. Check your connection and try again.`,
    });
  });
});

describe('Log out', () => {
  it('ends the session on the server, so the old cookie stops working', async () => {
    const { auth, client, server, requests } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    const cookie = await client.getCookie();
    await expect(whoseSession(server, cookie)).resolves.toBe('sam@example.edu');

    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
    const signOut = requests.find((request) => new URL(request.url).pathname.endsWith('/sign-out'));
    expect(signOut?.method).toBe('POST');
    expect(signOut?.headers.get('cookie')).toBe(cookie);
    await expect(whoseSession(server, cookie)).resolves.toBeNull();
  });

  it('forgets the session on the phone', async () => {
    const { auth, client } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');

    await auth.signOut();
    expect(await client.getCookie()).toBe('');
    await expect(auth.restore?.()).resolves.toBeNull();
  });

  it('forgets the session on the phone even with no connection', async () => {
    const { auth, client, goOffline } = setUp();
    await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
    goOffline();

    await auth.signOut();
    expect(await client.getCookie()).toBe('');
    await expect(auth.restore?.()).resolves.toBeNull();
  });

  it('does nothing harmful when nobody is signed in', async () => {
    const { auth } = setUp();
    await expect(auth.signOut()).resolves.toBeUndefined();
  });
});

describe('the auth the app uses', () => {
  it('opens on Log in, saying what is wrong, when the server address is not set', async () => {
    const auth = createAppAuth(
      () => {
        throw new Error('The server address is not set (EXPO_PUBLIC_API_URL)');
      },
      memoryStorage(),
      false
    );

    await expect(auth.restore?.()).resolves.toBeNull();
    await expect(auth.signIn('sam@example.edu', 'password-123')).resolves.toEqual({
      ok: false,
      message: 'The server address is not set (EXPO_PUBLIC_API_URL)',
    });
  });

  it('names the server in the no-connection message', async () => {
    const auth = createAppAuth(() => 'http://192.0.2.1:3000', memoryStorage(), false);
    // 192.0.2.1 is reserved for documentation, so nothing answers there.
    const offline = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    try {
      await expect(auth.signIn('sam@example.edu', 'password-123')).resolves.toEqual({
        ok: false,
        message: 'Could not reach the server at http://192.0.2.1:3000. Check your connection and try again.',
      });
    } finally {
      offline.mockRestore();
    }
  });

  it('makes one for the whole app and keeps it, so every screen shares the session', () => {
    expect(serverAuth()).toBe(serverAuth());
    expect(serverAuth().checksPasswords).toBe(true);
  });
});


it('stores an ordinary API renewal in the phone cookie through the Expo adapter', async () => {
  const { auth, client, server, storage } = setUp();
  await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
  const cookie = await client.getCookie();
  const session = await server.api.getSession({ headers: new Headers({ cookie }) });
  const day = 86_400_000, oldExpiry = new Date(Date.now() + 28 * day);
  await (await server.$context).internalAdapter.updateSession(session!.session.token, {
    expiresAt: oldExpiry, updatedAt: new Date(Date.now() - 2 * day),
  });
  const stored = JSON.parse(storage.saved.get('crunchweek_cookie')!);
  for (const value of Object.values(stored) as { expires: string }[]) value.expires = oldExpiry.toISOString();
  storage.saved.set('crunchweek_cookie', JSON.stringify(stored));
  const network = jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const reply = await server.api.getSession({ headers: new Headers(init?.headers), returnHeaders: true });
    return new Response(JSON.stringify(wallSemester), { headers: reply.headers });
  });
  setRequestAuth({ options: auth.requestOptions, onSessionEnded: jest.fn(), onResponse: auth.receiveResponse });
  try {
    await fetchSemester();
    const renewed = JSON.parse(storage.saved.get('crunchweek_cookie')!);
    const token = Object.entries(renewed).find(([key]) => key.includes('session_token'))![1] as { expires: string };
    expect(new Date(token.expires).getTime()).toBeGreaterThan(oldExpiry.getTime() + day);
    await expect(whoseSession(server, await client.getCookie())).resolves.toBe('sam@example.edu');
  } finally { setRequestAuth(null); network.mockRestore(); }
});

it('ignores a late renewal response after logout or a newer sign-in', async () => {
  const { auth, client, server } = setUp();
  await auth.signUp('Sam Student', 'sam@example.edu', 'password-123');
  const cookie = await client.getCookie();
  const session = await server.api.getSession({ headers: new Headers({ cookie }) });
  await (await server.$context).internalAdapter.updateSession(session!.session.token, {
    expiresAt: new Date(Date.now() + 28 * 86_400_000),
  });
  const reply = await server.api.getSession({ headers: new Headers({ cookie }), returnHeaders: true });
  expect(reply.headers.get('set-cookie')).toBeTruthy();
  await auth.signOut();
  auth.receiveResponse!(new Response(null, { headers: reply.headers }), { headers: { Cookie: cookie } });
  expect(await client.getCookie()).toBe('');
  await auth.signUp('New Student', 'new@example.edu', 'password-123');
  const newerCookie = await client.getCookie();
  auth.receiveResponse!(new Response(null, { headers: reply.headers }), { headers: { Cookie: cookie } });
  expect(await client.getCookie()).toBe(newerCookie);
  await expect(whoseSession(server, newerCookie)).resolves.toBe('new@example.edu');
});
