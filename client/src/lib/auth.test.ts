import { AuthClientLike, createServerAuth, localAuth } from './auth';

const SERVER = 'http://192.168.1.5:3000';
const NO_CONNECTION = `Could not reach the server at ${SERVER}. Check your connection and try again.`;

/** Any answer a Better Auth call can give, so one stand-in can give each of them. */
type AnyAnswer = { data: unknown; error: { status: number; message?: string } | null };

/** Better Auth's answer when the server agrees. */
const ok = (data: unknown): Promise<AnyAnswer> => Promise.resolve({ data, error: null });
/** Better Auth's answer when the server refuses: the status, and usually a message. */
const refused = (status: number, message?: string): Promise<AnyAnswer> =>
  Promise.resolve({ data: null, error: { status, message } });
/** What fetch does when there is no connection at all: it rejects. */
const offline = () => Promise.reject(new TypeError('Network request failed'));

const student = { user: { email: 'student@example.edu' } };

/** A stand-in for Better Auth's client. Each test sets the answers it needs. */
function fakeClient() {
  return {
    signIn: { email: jest.fn<Promise<AnyAnswer>, [unknown]>() },
    signUp: { email: jest.fn<Promise<AnyAnswer>, [unknown]>() },
    signOut: jest.fn<Promise<AnyAnswer>, []>(() => ok({ success: true })),
    getSession: jest.fn<Promise<AnyAnswer>, []>(() => ok(null)),
    getCookie: jest.fn<Promise<string>, []>(() => Promise.resolve('')),
  };
}

function setUp({ isWeb = false } = {}) {
  const client = fakeClient();
  // The stand-in answers loosely typed, so tests can also send malformed answers.
  const auth = createServerAuth(client as unknown as AuthClientLike, { serverAddress: SERVER, isWeb });
  return { client, auth };
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('signing in with the server', () => {
  it('sends the email and password, and returns who signed in', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(ok(student));

    await expect(auth.signIn('student@example.edu', 'example-password')).resolves.toEqual({
      ok: true,
      email: 'student@example.edu',
    });
    expect(client.signIn.email).toHaveBeenCalledWith({
      email: 'student@example.edu',
      password: 'example-password',
    });
  });

  it('shows the server message for a wrong password (401), as the login design says', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(refused(401, 'Invalid email or password'));

    await expect(auth.signIn('student@example.edu', 'wrong-password')).resolves.toEqual({
      ok: false,
      message: 'Invalid email or password',
    });
  });

  it('still says what went wrong when a 401 comes with no message', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(refused(401));

    await expect(auth.signIn('a@b.edu', 'wrong-password')).resolves.toEqual({
      ok: false,
      message: 'Wrong email or password.',
    });
  });

  it('treats an empty message like no message', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(refused(401, ''));

    await expect(auth.signIn('a@b.edu', 'wrong-password')).resolves.toEqual({
      ok: false,
      message: 'Wrong email or password.',
    });
  });

  it('names the server it tried when there is no connection', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockImplementation(offline);

    await expect(auth.signIn('a@b.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: NO_CONNECTION,
    });
  });

  it('treats a status of 0 (the request never got an answer) as no connection', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(refused(0));

    await expect(auth.signIn('a@b.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: NO_CONNECTION,
    });
  });

  it('gives the status when the server fails without a message', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(refused(500));

    await expect(auth.signIn('a@b.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: 'The server answered 500. Please try again.',
    });
  });

  it('refuses an answer with no user in it rather than signing in nobody', async () => {
    const { client, auth } = setUp();
    client.signIn.email.mockReturnValue(ok(null));

    await expect(auth.signIn('a@b.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: 'The server sent an answer the app did not understand. Please try again.',
    });
  });
});

describe('signing up with the server', () => {
  it('sends the name, email and password, and returns who signed up', async () => {
    const { client, auth } = setUp();
    client.signUp.email.mockReturnValue(ok(student));

    await expect(auth.signUp('Sam Student', 'student@example.edu', 'example-password')).resolves.toEqual({
      ok: true,
      email: 'student@example.edu',
    });
    expect(client.signUp.email).toHaveBeenCalledWith({
      name: 'Sam Student',
      email: 'student@example.edu',
      password: 'example-password',
    });
  });

  it('shows the server message when the email is already used (422)', async () => {
    const { client, auth } = setUp();
    client.signUp.email.mockReturnValue(refused(422, 'User already exists. Use another email.'));

    await expect(auth.signUp('Sam', 'student@example.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: 'User already exists. Use another email.',
    });
  });

  it('says the email is taken when a 422 comes with no message', async () => {
    const { client, auth } = setUp();
    client.signUp.email.mockReturnValue(refused(422));

    await expect(auth.signUp('Sam', 'student@example.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: 'An account with this email already exists.',
    });
  });

  it('shows the server message for a password that is too short (400)', async () => {
    const { client, auth } = setUp();
    client.signUp.email.mockReturnValue(refused(400, 'Password too short'));

    await expect(auth.signUp('Sam', 'student@example.edu', 'short')).resolves.toEqual({
      ok: false,
      message: 'Password too short',
    });
  });

  it('names the server it tried when there is no connection', async () => {
    const { client, auth } = setUp();
    client.signUp.email.mockImplementation(offline);

    await expect(auth.signUp('Sam', 'a@b.edu', 'example-password')).resolves.toEqual({
      ok: false,
      message: NO_CONNECTION,
    });
  });
});

describe('restoring the session when the app opens', () => {
  it('signs the student back in when the server still knows their session', async () => {
    const { client, auth } = setUp();
    client.getSession.mockReturnValue(ok(student));

    await expect(auth.restore?.()).resolves.toEqual({ email: 'student@example.edu' });
  });

  it('opens on Log in when the server says nobody is signed in', async () => {
    const { client, auth } = setUp();
    client.getSession.mockReturnValue(ok(null));
    client.getCookie.mockResolvedValue('better-auth.session_token=old');

    await expect(auth.restore?.()).resolves.toBeNull();
  });

  it('keeps a student with a saved session signed in when there is no connection', async () => {
    const { client, auth } = setUp();
    client.getSession.mockImplementation(offline);
    client.getCookie.mockResolvedValue('better-auth.session_token=abc');

    // The email is unknown offline; the semester screen then says the server is unreachable.
    await expect(auth.restore?.()).resolves.toEqual({ email: null });
  });

  it('keeps a student with a saved session signed in when the server is failing', async () => {
    const { client, auth } = setUp();
    client.getSession.mockReturnValue(refused(503));
    client.getCookie.mockResolvedValue('better-auth.session_token=abc');

    await expect(auth.restore?.()).resolves.toEqual({ email: null });
  });

  it('opens on Log in when there is no connection and nothing saved', async () => {
    const { client, auth } = setUp();
    client.getSession.mockImplementation(offline);

    await expect(auth.restore?.()).resolves.toBeNull();
  });

  it('opens on Log in, and logs why, when the saved session cannot be read', async () => {
    const { client, auth } = setUp();
    client.getSession.mockImplementation(offline);
    client.getCookie.mockRejectedValue(new Error('keychain locked'));

    await expect(auth.restore?.()).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it('opens on Log in when the server answers 401', async () => {
    const { client, auth } = setUp();
    client.getSession.mockReturnValue(refused(401));
    client.getCookie.mockResolvedValue('better-auth.session_token=abc');

    await expect(auth.restore?.()).resolves.toBeNull();
  });
});

describe('logging out with the server', () => {
  it('asks the server to end the session', async () => {
    const { client, auth } = setUp();

    await auth.signOut();
    expect(client.signOut).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('does not throw, and logs why, when there is no connection', async () => {
    const { client, auth } = setUp();
    client.signOut.mockImplementation(offline);

    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('does not throw, and logs why, when the server refuses', async () => {
    const { client, auth } = setUp();
    client.signOut.mockReturnValue(refused(500));

    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('proving who is asking, on our own routes', () => {
  it('sends the saved cookie by hand on a phone, with credentials omitted', async () => {
    const { client, auth } = setUp();
    client.getCookie.mockResolvedValue('better-auth.session_token=abc');

    await expect(auth.requestOptions()).resolves.toEqual({
      headers: { Cookie: 'better-auth.session_token=abc' },
      credentials: 'omit',
    });
  });

  it('waits for the cookie, which Better Auth hands back as a promise', async () => {
    const { client, auth } = setUp();
    client.getCookie.mockResolvedValue('better-auth.session_token=abc');

    const options = await auth.requestOptions();
    expect((options.headers as Record<string, string>).Cookie).not.toMatch(/object Promise/);
  });

  it('sends no Cookie header when nothing is saved', async () => {
    const { auth } = setUp();
    await expect(auth.requestOptions()).resolves.toEqual({ headers: {}, credentials: 'omit' });
  });

  it('sends no Cookie header, and logs why, when the cookie cannot be read', async () => {
    const { client, auth } = setUp();
    client.getCookie.mockRejectedValue(new Error('keychain locked'));

    await expect(auth.requestOptions()).resolves.toEqual({ headers: {}, credentials: 'omit' });
    expect(consoleError).toHaveBeenCalled();
  });

  it('lets the browser send its own cookie on the web version', async () => {
    const { client, auth } = setUp({ isWeb: true });

    await expect(auth.requestOptions()).resolves.toEqual({ credentials: 'include' });
    expect(client.getCookie).not.toHaveBeenCalled();
  });

  it('says the server checks passwords', () => {
    expect(setUp().auth.checksPasswords).toBe(true);
  });
});

describe('local sign-in, for sample-data mode', () => {
  it('signs in with any email and password, as before', async () => {
    await expect(localAuth.signIn('student@example.edu', 'anything')).resolves.toEqual({
      ok: true,
      email: 'student@example.edu',
    });
  });

  it('signs up with any name, email and password', async () => {
    await expect(localAuth.signUp('Sam', 'student@example.edu', 'anything')).resolves.toEqual({
      ok: true,
      email: 'student@example.edu',
    });
  });

  it('has nothing to restore, so the app opens on Log in as before', () => {
    expect(localAuth.restore).toBeUndefined();
  });

  it('adds nothing to requests', async () => {
    await expect(localAuth.requestOptions()).resolves.toEqual({});
  });

  it('logs out without doing anything else', async () => {
    await expect(localAuth.signOut()).resolves.toBeUndefined();
  });

  it('says it does not check passwords', () => {
    expect(localAuth.checksPasswords).toBe(false);
  });
});
