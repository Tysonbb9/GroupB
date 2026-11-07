import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import React from 'react';
import { Pressable, Text } from 'react-native';
import RootLayout from '../app/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import LoginScreen from '../app/login';
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
