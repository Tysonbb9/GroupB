import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fetchSemester, SESSION_ENDED_MESSAGE } from '../lib/api';
import { Auth, AuthResult, RestoredSession } from '../lib/auth';
import { SessionProvider, useSession } from '../state/session';
import { wallSemester } from '../testing/fixtures';

/**
 * US-20: who is signed in, with the server (a stand-in Auth here) and
 * without it (sample-data mode, the default).
 */

const COOKIE = 'better-auth.session_token=abc';

/** A stand-in for signing in with the server. Each test sets the answers it needs. */
function serverAuth(restored: RestoredSession | null = null) {
  return {
    checksPasswords: true,
    restore: jest.fn<Promise<RestoredSession | null>, []>(() => Promise.resolve(restored)),
    signIn: jest.fn<Promise<AuthResult>, [string, string]>((email) => Promise.resolve({ ok: true, email })),
    signUp: jest.fn<Promise<AuthResult>, [string, string, string]>((_name, email) =>
      Promise.resolve({ ok: true, email })
    ),
    signOut: jest.fn<Promise<void>, []>(() => Promise.resolve()),
    requestOptions: jest.fn<Promise<RequestInit>, []>(() =>
      Promise.resolve({ headers: { Cookie: COOKIE }, credentials: 'omit' })
    ),
  } satisfies Auth;
}

/** Shows the session, and has a button for each thing a screen can ask of it. */
function Probe() {
  const session = useSession();
  const [answer, setAnswer] = useState('');
  const show = (message: string | null) => setAnswer(message ?? 'signed in');
  return (
    <>
      <Text testID="state">
        {session.checking ? 'checking' : session.signedIn ? `in as ${session.email ?? 'unknown'}` : 'out'}
      </Text>
      <Text testID="notice">{session.notice ?? ''}</Text>
      <Text testID="answer">{answer}</Text>
      <Text testID="checks-passwords">{String(session.checksPasswords)}</Text>
      <Pressable testID="sign-in" onPress={() => session.signIn('sam@example.edu', 'password-123').then(show)} />
      <Pressable
        testID="sign-up"
        onPress={() => session.signUp('Sam', 'sam@example.edu', 'password-123').then(show)}
      />
      <Pressable testID="sign-out" onPress={session.signOut} />
    </>
  );
}

const state = () => screen.getByTestId('state');

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => wallSemester } as Response);
  globalThis.fetch = fetchMock as typeof fetch;
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('sample-data mode (no server)', () => {
  it('opens signed out, with nothing to check', () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );
    expect(state()).toHaveTextContent('out');
    expect(screen.getByTestId('checks-passwords')).toHaveTextContent('false');
  });

  it('signs in with any email and password, as before', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );
    fireEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
  });

  it('signs up with any name, email and password', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>
    );
    fireEvent.press(screen.getByTestId('sign-up'));
    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
  });

  it('logs out', async () => {
    render(
      <SessionProvider initialEmail="sam@example.edu">
        <Probe />
      </SessionProvider>
    );
    fireEvent.press(screen.getByTestId('sign-out'));
    expect(state()).toHaveTextContent('out');
  });

  it('adds no cookie to requests, even when signed in', async () => {
    render(
      <SessionProvider initialEmail="sam@example.edu">
        <Probe />
      </SessionProvider>
    );
    await fetchSemester();
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBeUndefined();
  });
});

describe('opening the app with the server', () => {
  it('checks for a saved session before showing anything', async () => {
    const auth = serverAuth({ email: 'sam@example.edu' });
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    expect(state()).toHaveTextContent('checking');
    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
    expect(auth.restore).toHaveBeenCalledTimes(1);
  });

  it('opens signed out when there is no saved session', async () => {
    render(
      <SessionProvider auth={serverAuth(null)}>
        <Probe />
      </SessionProvider>
    );
    expect(await screen.findByText('out')).toBeTruthy();
  });

  it('opens signed in, email unknown, when offline with a saved session', async () => {
    render(
      <SessionProvider auth={serverAuth({ email: null })}>
        <Probe />
      </SessionProvider>
    );
    expect(await screen.findByText('in as unknown')).toBeTruthy();
  });

  it('opens signed out, and logs why, if checking fails unexpectedly', async () => {
    const auth = serverAuth();
    auth.restore.mockRejectedValue(new Error('surprise'));
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    expect(await screen.findByText('out')).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });

  it('does not touch the session after the app has closed', async () => {
    let finish: (restored: RestoredSession | null) => void = () => {};
    const auth = serverAuth();
    auth.restore.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const app = render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    app.unmount();
    await act(async () => finish({ email: 'sam@example.edu' }));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('says the server checks passwords', async () => {
    render(
      <SessionProvider auth={serverAuth()}>
        <Probe />
      </SessionProvider>
    );
    expect(screen.getByTestId('checks-passwords')).toHaveTextContent('true');
    await screen.findByText('out');
  });
});

describe('signing in and up with the server', () => {
  it('signs in when the server accepts', async () => {
    const auth = serverAuth();
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('out');
    fireEvent.press(screen.getByTestId('sign-in'));

    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
    expect(auth.signIn).toHaveBeenCalledWith('sam@example.edu', 'password-123');
    expect(screen.getByTestId('answer')).toHaveTextContent('signed in');
  });

  it('stays signed out, and hands back the message, when the server refuses', async () => {
    const auth = serverAuth();
    auth.signIn.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('out');
    fireEvent.press(screen.getByTestId('sign-in'));

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(state()).toHaveTextContent('out');
  });

  it('signs up when the server accepts', async () => {
    const auth = serverAuth();
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('out');
    fireEvent.press(screen.getByTestId('sign-up'));

    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
    expect(auth.signUp).toHaveBeenCalledWith('Sam', 'sam@example.edu', 'password-123');
  });

  it('stays signed out, and hands back the message, when sign-up is refused', async () => {
    const auth = serverAuth();
    auth.signUp.mockResolvedValue({ ok: false, message: 'User already exists. Use another email.' });
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('out');
    fireEvent.press(screen.getByTestId('sign-up'));

    expect(await screen.findByText('User already exists. Use another email.')).toBeTruthy();
    expect(state()).toHaveTextContent('out');
  });
});

describe('the session and our requests', () => {
  it('sends the cookie on requests while signed in', async () => {
    render(
      <SessionProvider auth={serverAuth({ email: 'sam@example.edu' })}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    await fetchSemester();

    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe(COOKIE);
  });

  it('is ready before the first request of a student who opens already signed in', async () => {
    // Children's effects run before their parent's, so the semester's first
    // fetch must still find the session in place.
    function FetchOnMount() {
      React.useEffect(() => {
        fetchSemester().catch(() => {});
      }, []);
      return null;
    }
    render(
      <SessionProvider auth={serverAuth()} initialEmail="sam@example.edu">
        <FetchOnMount />
      </SessionProvider>
    );
    await act(async () => {});
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe(COOKIE);
  });

  it('goes back to Log in, saying why, when the server says the session has ended', async () => {
    render(
      <SessionProvider auth={serverAuth({ email: 'sam@example.edu' })}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);

    await act(async () => {
      await expect(fetchSemester()).rejects.toThrow(SESSION_ENDED_MESSAGE);
    });
    expect(state()).toHaveTextContent('out');
    expect(screen.getByTestId('notice')).toHaveTextContent(SESSION_ENDED_MESSAGE);
  });

  it('clears that notice once the student signs in again', async () => {
    render(
      <SessionProvider auth={serverAuth({ email: 'sam@example.edu' })}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    await act(async () => {
      await fetchSemester().catch(() => {});
    });

    fireEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByText('in as sam@example.edu')).toBeTruthy();
    expect(screen.getByTestId('notice')).toHaveTextContent('');
  });

  it('stops sending the cookie once the app closes', async () => {
    const app = render(
      <SessionProvider auth={serverAuth({ email: 'sam@example.edu' })}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    app.unmount();
    await fetchSemester();

    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBeUndefined();
  });
});

describe('Log out with the server', () => {
  it('signs out straight away and ends the session on the server', async () => {
    const auth = serverAuth({ email: 'sam@example.edu' });
    render(
      <SessionProvider auth={auth}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    fireEvent.press(screen.getByTestId('sign-out'));

    expect(state()).toHaveTextContent('out');
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it('leaves no notice, since the student chose to log out', async () => {
    render(
      <SessionProvider auth={serverAuth({ email: 'sam@example.edu' })}>
        <Probe />
      </SessionProvider>
    );
    await screen.findByText('in as sam@example.edu');
    fireEvent.press(screen.getByTestId('sign-out'));
    await act(async () => {});

    expect(screen.getByTestId('notice')).toHaveTextContent('');
  });
});
