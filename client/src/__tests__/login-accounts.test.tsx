import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import LoginScreen from '../app/login';
import { SESSION_ENDED_MESSAGE, fetchSemester } from '../lib/api';
import { Auth, AuthResult } from '../lib/auth';
import { SessionProvider, useSession } from '../state/session';

/**
 * US-20: the Log in screen with real accounts. A stand-in plays the server,
 * answering as docs/LOGIN_DESIGN.md says the real one does.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** Sam has an account with this password; nobody else does. */
const SAM = { email: 'sam@example.edu', password: 'password-123' };

/** A stand-in for the server: one account, and the answers from the login design. */
function serverAuth() {
  const accounts = new Map([[SAM.email, SAM.password]]);
  return {
    checksPasswords: true,
    restore: jest.fn(() => Promise.resolve(null)),
    signIn: jest.fn(async (email: string, password: string): Promise<AuthResult> =>
      accounts.get(email) === password
        ? { ok: true, email }
        : { ok: false, message: 'Invalid email or password' }
    ),
    signUp: jest.fn(async (_name: string, email: string, password: string): Promise<AuthResult> => {
      if (accounts.has(email)) return { ok: false, message: 'User already exists. Use another email.' };
      accounts.set(email, password);
      return { ok: true, email };
    }),
    signOut: jest.fn(() => Promise.resolve()),
    requestOptions: jest.fn(() => Promise.resolve({})),
  } satisfies Auth;
}

function SignedInAs() {
  const { email, signedIn, signOut } = useSession();
  return (
    <Text testID="signed-in-as" onPress={signOut}>
      {signedIn ? email : 'nobody'}
    </Text>
  );
}

async function renderLogin(auth: Auth = serverAuth()) {
  render(
    <SessionProvider auth={auth}>
      <LoginScreen />
      <SignedInAs />
    </SessionProvider>
  );
  // Let the check for a saved session finish.
  await act(async () => {});
  return auth;
}

const signedInAs = () => screen.getByTestId('signed-in-as');
const message = () => screen.getByTestId('login-message');

function type(testID: string, value: string) {
  fireEvent.changeText(screen.getByTestId(testID), value);
}

async function logIn(email: string, password: string) {
  type('login-email', email);
  type('login-password', password);
  await act(async () => {
    fireEvent.press(screen.getByTestId('login-submit'));
  });
}

async function signUp(name: string, email: string, password: string) {
  fireEvent.press(screen.getByTestId('switch-mode'));
  type('login-name', name);
  type('login-email', email);
  type('login-password', password);
  await act(async () => {
    fireEvent.press(screen.getByTestId('login-submit'));
  });
}

describe('logging in with an account', () => {
  it('signs in with the right password', async () => {
    await renderLogin();
    await logIn(SAM.email, SAM.password);
    expect(signedInAs()).toHaveTextContent(SAM.email);
  });

  it('refuses a wrong password, with the server message', async () => {
    await renderLogin();
    await logIn(SAM.email, 'wrong-password');

    expect(message()).toHaveTextContent('Invalid email or password');
    expect(signedInAs()).toHaveTextContent('nobody');
  });

  it('refuses an email with no account, with the same message', async () => {
    await renderLogin();
    await logIn('nobody@example.edu', SAM.password);

    expect(message()).toHaveTextContent('Invalid email or password');
    expect(signedInAs()).toHaveTextContent('nobody');
  });

  it('sends the email trimmed, and the password exactly as typed', async () => {
    const auth = await renderLogin();
    await logIn('  sam@example.edu ', ' password-123 ');
    expect(auth.signIn).toHaveBeenCalledWith('sam@example.edu', ' password-123 ');
  });

  it('shows the no-connection message', async () => {
    const auth = serverAuth();
    auth.signIn.mockResolvedValue({
      ok: false,
      message: 'Could not reach the server at http://x:3000. Check your connection and try again.',
    });
    await renderLogin(auth);
    await logIn(SAM.email, SAM.password);

    expect(message()).toHaveTextContent(/Could not reach the server.*Check your connection/);
  });

  it('clears the message when the student edits a field', async () => {
    await renderLogin();
    await logIn(SAM.email, 'wrong-password');
    type('login-password', 'password-12');

    expect(screen.queryByTestId('login-message')).toBeNull();
  });

  it('does not say any password works, since the server checks them', async () => {
    await renderLogin();
    expect(screen.queryByTestId('login-note')).toBeNull();
  });

  it('does not ask the server when a field is empty', async () => {
    const auth = await renderLogin();
    await logIn(SAM.email, '');

    expect(message()).toHaveTextContent('Please enter your email and password.');
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('does not ask the server when the email is not valid', async () => {
    const auth = await renderLogin();
    await logIn('not-an-email', SAM.password);

    expect(message()).toHaveTextContent('Please enter a valid email address.');
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});

describe('while waiting for the server', () => {
  function slowAuth() {
    const auth = serverAuth();
    let answer: (result: AuthResult) => void = () => {};
    auth.signIn.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    return { auth, answer: (result: AuthResult) => answer(result) };
  }

  it('says it is logging in, and will not send twice', async () => {
    const { auth, answer } = slowAuth();
    await renderLogin(auth);
    type('login-email', SAM.email);
    type('login-password', SAM.password);
    fireEvent.press(screen.getByTestId('login-submit'));
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByTestId('login-submit')).toHaveTextContent('Logging in…');
    expect(screen.getByTestId('login-submit')).toBeDisabled();
    expect(auth.signIn).toHaveBeenCalledTimes(1);

    await act(async () => answer({ ok: true, email: SAM.email }));
    expect(signedInAs()).toHaveTextContent(SAM.email);
  });

  it('can be tried again after a refusal', async () => {
    const { auth, answer } = slowAuth();
    await renderLogin(auth);
    type('login-email', SAM.email);
    type('login-password', 'wrong-password');
    fireEvent.press(screen.getByTestId('login-submit'));
    await act(async () => answer({ ok: false, message: 'Invalid email or password' }));

    expect(screen.getByTestId('login-submit')).toHaveTextContent('Log in');
    expect(screen.getByTestId('login-submit')).not.toBeDisabled();
  });
});

describe('creating an account', () => {
  it('switches to a sign-up form that also asks for a name', async () => {
    await renderLogin();
    fireEvent.press(screen.getByTestId('switch-mode'));

    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toHaveTextContent('Create account');
  });

  it('switches back to Log in, without the name field', async () => {
    await renderLogin();
    fireEvent.press(screen.getByTestId('switch-mode'));
    fireEvent.press(screen.getByTestId('switch-mode'));

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('signs up a new student, who is then signed in', async () => {
    const auth = await renderLogin();
    await signUp('  New Student ', ' new@example.edu ', 'new-password');

    expect(auth.signUp).toHaveBeenCalledWith('New Student', 'new@example.edu', 'new-password');
    expect(signedInAs()).toHaveTextContent('new@example.edu');
  });

  it('lets a new student sign up, log out, and log back in', async () => {
    await renderLogin();
    await signUp('New Student', 'new@example.edu', 'new-password');
    fireEvent.press(signedInAs()); // logs out
    // In the app the screen reopens on Log in; here it stayed on, still on Create account.
    fireEvent.press(screen.getByTestId('switch-mode'));
    await logIn('new@example.edu', 'new-password');

    expect(signedInAs()).toHaveTextContent('new@example.edu');
  });

  it('refuses an email that is already used, with the server message', async () => {
    await renderLogin();
    await signUp('Another Sam', SAM.email, 'another-password');

    expect(message()).toHaveTextContent('User already exists. Use another email.');
    expect(signedInAs()).toHaveTextContent('nobody');
  });

  it('asks for all three fields before asking the server', async () => {
    const auth = await renderLogin();
    await signUp('', 'new@example.edu', 'new-password');

    expect(message()).toHaveTextContent('Please enter your name, email and password.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('treats a name of only spaces as empty', async () => {
    const auth = await renderLogin();
    await signUp('   ', 'new@example.edu', 'new-password');

    expect(message()).toHaveTextContent('Please enter your name, email and password.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('checks the email before asking the server', async () => {
    const auth = await renderLogin();
    await signUp('New Student', 'not-an-email', 'new-password');

    expect(message()).toHaveTextContent('Please enter a valid email address.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('asks for at least 8 characters, as the server does, before asking it', async () => {
    const auth = await renderLogin();
    await signUp('New Student', 'new@example.edu', '1234567');

    expect(message()).toHaveTextContent('Please choose a password of at least 8 characters.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('accepts a password of exactly 8 characters', async () => {
    const auth = await renderLogin();
    await signUp('New Student', 'new@example.edu', '12345678');
    expect(auth.signUp).toHaveBeenCalledWith('New Student', 'new@example.edu', '12345678');
  });

  it('says it is creating the account while waiting', async () => {
    const auth = serverAuth();
    auth.signUp.mockReturnValue(new Promise(() => {}));
    await renderLogin(auth);
    fireEvent.press(screen.getByTestId('switch-mode'));
    type('login-name', 'New Student');
    type('login-email', 'new@example.edu');
    type('login-password', 'new-password');
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByTestId('login-submit')).toHaveTextContent('Creating account…');
  });

  it('suggests a new password, not a saved one, when signing up', async () => {
    await renderLogin();
    expect(screen.getByTestId('login-password').props.autoComplete).toBe('password');
    fireEvent.press(screen.getByTestId('switch-mode'));
    expect(screen.getByTestId('login-password').props.autoComplete).toBe('new-password');
  });

  it('clears an old message when switching between the two forms', async () => {
    await renderLogin();
    await logIn(SAM.email, 'wrong-password');
    fireEvent.press(screen.getByTestId('switch-mode'));

    expect(screen.queryByTestId('login-message')).toBeNull();
  });

  it('works in sample-data mode too, with no server', async () => {
    render(
      <SessionProvider>
        <LoginScreen />
        <SignedInAs />
      </SessionProvider>
    );
    await signUp('New Student', 'new@example.edu', 'new-password');
    expect(signedInAs()).toHaveTextContent('new@example.edu');
  });
});

describe('when the session has ended', () => {
  it('says why the student is back on Log in', async () => {
    const auth = serverAuth();
    auth.restore.mockResolvedValue({ email: SAM.email } as never);
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const realFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      await renderLogin(auth);
      await act(async () => {
        await fetchSemester().catch(() => {});
      });
      expect(screen.getByTestId('login-notice')).toHaveTextContent(SESSION_ENDED_MESSAGE);

      // Starting to type again means they have read it.
      type('login-email', SAM.email);
      expect(screen.queryByTestId('login-notice')).toBeNull();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('shows no notice on an ordinary visit', async () => {
    await renderLogin();
    expect(screen.queryByTestId('login-notice')).toBeNull();
  });
});
