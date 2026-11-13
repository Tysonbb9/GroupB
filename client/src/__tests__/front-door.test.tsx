import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import React from 'react';
import { Pressable, Text } from 'react-native';
import RootLayout from '../app/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import LoginScreen from '../app/login';
import { fetchSemester, SESSION_ENDED_MESSAGE } from '../lib/api';
import { Auth, AuthResult, RestoredSession } from '../lib/auth';
import { useSemester } from '../state/semester-store';
import { useSession } from '../state/session';

jest.setTimeout(30000);

// The app loads its semester from the server once someone signs in.
// (jest.mock runs before the imports above, so it fetches the fixture itself.)
jest.mock('../lib/api', () => ({
  ...jest.requireActual('../lib/api'),
  fetchSemester: jest.fn(() =>
    Promise.resolve(jest.requireActual('../testing/fixtures').wallSemester)
  ),
}));

/**
 * The server's side of signing in, stood in for: it accepts any password
 * unless a test says otherwise. (Real Better Auth is in lib/auth-client.test.ts.)
 */
function mockAuthWith(restored: RestoredSession | null = null) {
  return {
    checksPasswords: true,
    restore: jest.fn<Promise<RestoredSession | null>, []>(() => Promise.resolve(restored)),
    signIn: jest.fn<Promise<AuthResult>, [string, string]>((email) => Promise.resolve({ ok: true, email })),
    signUp: jest.fn<Promise<AuthResult>, [string, string, string]>((_name, email) =>
      Promise.resolve({ ok: true, email })
    ),
    signOut: jest.fn<Promise<void>, []>(() => Promise.resolve()),
    requestOptions: jest.fn<Promise<RequestInit>, []>(() => Promise.resolve({})),
  } satisfies Auth;
}
let mockAuth = mockAuthWith();

// The real router, with the splash screen's two calls recorded instead of run.
const mockHideSplash = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, SplashScreen: { preventAutoHideAsync: jest.fn(), hide: () => mockHideSplash() } };
});
jest.mock('../lib/auth-client', () => ({ serverAuth: () => mockAuth }));

beforeEach(() => {
  mockAuth = mockAuthWith();
});

/** Stands in for Forecast: proves the semester loaded, and can sign out. */
function ForecastStandIn() {
  const { semester } = useSemester();
  const { signOut } = useSession();
  return (
    <Pressable testID="stand-in-log-out" onPress={signOut}>
      <Text>Forecast for {semester.label}</Text>
    </Pressable>
  );
}

/**
 * The real root layout, tab bar and Log in screen, with stand-ins for the
 * tab screens, so these tests are about the front door and nothing else.
 * renderRouter returns a promise (expo-router 58), so every test awaits it.
 */
function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      login: LoginScreen,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': ForecastStandIn,
      '(tabs)/week': () => <Text>This week</Text>,
      '(tabs)/courses': () => <Text>Courses</Text>,
      syllabus: () => <Text>Add a syllabus</Text>,
    },
    { initialUrl }
  );
}

function logIn() {
  fireEvent.changeText(screen.getByTestId('login-email'), 'student@example.edu');
  fireEvent.changeText(screen.getByTestId('login-password'), 'example-password');
  fireEvent.press(screen.getByTestId('login-submit'));
}

describe('Log in is the front door', () => {
  it('opens on Log in, not on the app', async () => {
    const app = await renderApp();
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.queryByText(/Forecast for/)).toBeNull();
    expect(app.getPathname()).toBe('/login');
  });

  it('keeps every screen behind it, even one opened by its address', async () => {
    await renderApp('/syllabus');
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.queryByText('Add a syllabus')).toBeNull();
  });

  it('opens Forecast, with the semester loaded, once the student signs in', async () => {
    const app = await renderApp();
    logIn();
    expect(await screen.findByText('Forecast for Fall 2026')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('goes back to Log in when the student logs out', async () => {
    await renderApp();
    logIn();
    fireEvent.press(await screen.findByTestId('stand-in-log-out'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });
});

describe('Accounts at the front door (US-20)', () => {
  it('opens straight into the app when a session was kept from last time', async () => {
    mockAuth = mockAuthWith({ email: 'student@example.edu' });
    const app = await renderApp();

    expect(await screen.findByText('Forecast for Fall 2026')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('opens on Log in when no session was kept', async () => {
    await renderApp();
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    expect(mockAuth.restore).toHaveBeenCalledTimes(1);
  });

  it('keeps the splash screen up until it knows whether the student is signed in', async () => {
    mockHideSplash.mockClear();
    let finish: (restored: RestoredSession | null) => void = () => {};
    mockAuth.restore.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderApp();
    expect(mockHideSplash).not.toHaveBeenCalled();

    await act(async () => finish(null));
    expect(mockHideSplash).toHaveBeenCalled();
  });

  it('keeps a student with the wrong password on Log in', async () => {
    mockAuth.signIn.mockResolvedValue({ ok: false, message: 'Invalid email or password' });
    await renderApp();
    logIn();

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(screen.queryByText(/Forecast for/)).toBeNull();
  });

  it('opens the app for a student who has just created an account', async () => {
    await renderApp();
    fireEvent.press(screen.getByTestId('switch-mode'));
    fireEvent.changeText(screen.getByTestId('login-name'), 'New Student');
    fireEvent.changeText(screen.getByTestId('login-email'), 'new@example.edu');
    fireEvent.changeText(screen.getByTestId('login-password'), 'new-password');
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByText('Forecast for Fall 2026')).toBeTruthy();
    expect(mockAuth.signUp).toHaveBeenCalledWith('New Student', 'new@example.edu', 'new-password');
  });

  it('ends the session on the server when the student logs out', async () => {
    await renderApp();
    logIn();
    fireEvent.press(await screen.findByTestId('stand-in-log-out'));

    await screen.findByText('Welcome back');
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('goes back to Log in, saying why, when the server says the session has ended', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    // This time the semester request really goes out, and gets a 401.
    (fetchSemester as jest.Mock).mockImplementationOnce(jest.requireActual('../lib/api').fetchSemester);
    try {
      mockAuth = mockAuthWith({ email: 'student@example.edu' });
      await renderApp();

      expect(await screen.findByText(SESSION_ENDED_MESSAGE)).toBeTruthy();
      expect(screen.getByText('Welcome back')).toBeTruthy();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

/**
 * Until the semester arrives, the loading or error screen stands in for the
 * whole app, so Log out has to be offered there too (review of #129).
 */
describe('Log out before the semester has loaded', () => {
  const mockFetch = fetchSemester as jest.Mock;

  it('is offered while the semester is still loading', async () => {
    // A server the phone cannot reach: the request never settles.
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    await renderApp();
    logIn();

    expect(await screen.findByTestId('loading')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Log out student@example.edu'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('is offered when the semester could not be loaded', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
    await renderApp();
    logIn();

    expect(await screen.findByText('Could not load your semester')).toBeTruthy();
    expect(screen.getByTestId('retry')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Log out student@example.edu'));
    expect(await screen.findByText('Welcome back')).toBeTruthy();
  });

  it('loads the semester again for the next sign-in', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
    await renderApp();
    logIn();
    await screen.findByText('Could not load your semester');
    fireEvent.press(screen.getByLabelText('Log out student@example.edu'));
    await screen.findByText('Welcome back');

    logIn();
    expect(await screen.findByText('Forecast for Fall 2026')).toBeTruthy();
  });
});
