import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import React from 'react';
import { Text } from 'react-native';
import RootLayout from '../app/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import LoginScreen from '../app/login';
import WelcomeScreen from '../app/welcome';
import { HelpButton } from '../components/HelpButton';
import { saveWeeklyCapacity } from '../lib/api';
import { Auth, AuthResult, RestoredSession } from '../lib/auth';
import { useSemester } from '../state/semester-store';

jest.setTimeout(30000);

// The semester comes from the server once someone signs in, and new hours
// are saved there. (jest.mock runs before the imports above.)
jest.mock('../lib/api', () => ({
  ...jest.requireActual('../lib/api'),
  fetchSemester: jest.fn(() => Promise.resolve(jest.requireActual('../testing/fixtures').wallSemester)),
  saveWeeklyCapacity: jest.fn((hours: number) => Promise.resolve(hours)),
}));

/** The server's side of signing in, as in front-door.test.tsx: every password works. */
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

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, SplashScreen: { preventAutoHideAsync: jest.fn(), hide: jest.fn() } };
});
jest.mock('../lib/auth-client', () => ({ serverAuth: () => mockAuth }));

beforeEach(() => {
  mockAuth = mockAuthWith();
  (saveWeeklyCapacity as jest.Mock).mockClear();
});

/** Stands in for Forecast: shows the hours a week, with the real Help button. */
function ForecastStandIn() {
  const { semester } = useSemester();
  return (
    <>
      <Text>Forecast: {semester.weeklyCapacity} hours a week</Text>
      <HelpButton />
    </>
  );
}

/** The real root layout, tab layout, Log in and welcome; stand-ins for the rest. */
function renderApp() {
  return renderRouter({
    _layout: RootLayout,
    login: LoginScreen,
    welcome: WelcomeScreen,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/index': ForecastStandIn,
    '(tabs)/week': () => <Text>This week</Text>,
    '(tabs)/courses': () => <Text>Courses</Text>,
    'add-course': () => <Text>Add a course screen</Text>,
  });
}

function signUp() {
  fireEvent.press(screen.getByTestId('switch-mode'));
  fireEvent.changeText(screen.getByTestId('login-name'), 'New Student');
  fireEvent.changeText(screen.getByTestId('login-email'), 'new@example.edu');
  fireEvent.changeText(screen.getByTestId('login-password'), 'new-password');
  fireEvent.press(screen.getByTestId('login-submit'));
}

function logIn() {
  fireEvent.changeText(screen.getByTestId('login-email'), 'student@example.edu');
  fireEvent.changeText(screen.getByTestId('login-password'), 'example-password');
  fireEvent.press(screen.getByTestId('login-submit'));
}

describe('First run (US-47)', () => {
  it('shows a new account the welcome right after signing up', async () => {
    const app = await renderApp();
    signUp();

    expect(await screen.findByTestId('welcome')).toBeTruthy();
    expect(app.getPathname()).toBe('/welcome');
  });

  it('shows it only once: Skip goes to Forecast, and it does not open again', async () => {
    const app = await renderApp();
    signUp();
    fireEvent.press(await screen.findByTestId('welcome-skip'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  it('never shows it to a returning student who logs in', async () => {
    const app = await renderApp();
    logIn();

    expect(await screen.findByText(/Forecast:/)).toBeTruthy();
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByTestId('welcome')).toBeNull();
  });

  it('never shows it when a session was kept from last time', async () => {
    mockAuth = mockAuthWith({ email: 'student@example.edu' });
    const app = await renderApp();

    expect(await screen.findByText(/Forecast:/)).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('sets the hours a week, and Forecast uses them', async () => {
    const app = await renderApp();
    signUp();
    fireEvent.press(await screen.findByTestId('welcome-next'));
    fireEvent.changeText(screen.getByTestId('welcome-hours'), '20');
    fireEvent.press(screen.getByTestId('welcome-save-hours'));
    fireEvent.press(await screen.findByTestId('welcome-later'));

    await waitFor(() => expect(app.getPathname()).toBe('/'));
    expect(saveWeeklyCapacity).toHaveBeenCalledWith(20);
    expect(screen.getByText('Forecast: 20 hours a week')).toBeTruthy();
  });

  it('points to Add a course from the last step', async () => {
    const app = await renderApp();
    signUp();
    fireEvent.press(await screen.findByTestId('welcome-next'));
    fireEvent.press(screen.getByTestId('welcome-save-hours'));
    fireEvent.press(await screen.findByTestId('welcome-add-course'));

    expect(await screen.findByText('Add a course screen')).toBeTruthy();
    expect(app.getPathname()).toBe('/add-course');
  });

  it('opens again from Help, for any student', async () => {
    const app = await renderApp();
    logIn();
    fireEvent.press(await screen.findByTestId('open-welcome'));

    expect(await screen.findByTestId('welcome')).toBeTruthy();
    expect(app.getPathname()).toBe('/welcome');
  });
});
