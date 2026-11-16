import { render } from '@testing-library/react-native';
import React from 'react';

/**
 * Issue #163: the back button on Add a Syllabus said "(tabs)", the name of the
 * screen before it. The stack's screens are replaced by stand-ins that record
 * the options they were given, so no navigation is needed.
 */

const mockScreens: Record<string, Record<string, unknown>> = {};

jest.mock('expo-router', () => {
  function Stack({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  Stack.Screen = function Screen({ name, options }: { name: string; options: Record<string, unknown> }) {
    mockScreens[name] = options;
    return null;
  };
  Stack.Protected = function Protected({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
  return { Stack, SplashScreen: { preventAutoHideAsync: jest.fn(), hide: jest.fn() } };
});

function renderRootLayout() {
  // The sample-data switch is read when the layout loads, so it is set before
  // the layout is first required. It keeps the real server and its sign-in
  // out of this test.
  process.env.EXPO_PUBLIC_USE_FIXTURE = '1';
  // A require, not an import, because an import would load the layout first.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RootLayout: React.ComponentType = require('../app/_layout').default;
  return render(<RootLayout />);
}

// Put the sample-data switch back as it was, so nothing after this file sees it.
const fixtureSwitch = process.env.EXPO_PUBLIC_USE_FIXTURE;
afterAll(() => {
  if (fixtureSwitch === undefined) delete process.env.EXPO_PUBLIC_USE_FIXTURE;
  else process.env.EXPO_PUBLIC_USE_FIXTURE = fixtureSwitch;
});

describe('the stack of screens', () => {
  it('gives Add a Syllabus its title and a back button that says Back', () => {
    renderRootLayout();

    expect(mockScreens.syllabus.title).toBe('Add a Syllabus');
    expect(mockScreens.syllabus.headerBackTitle).toBe('Back');
  });

  it('still hides the stack header on the tabs and on Log in', () => {
    renderRootLayout();

    expect(mockScreens['(tabs)'].headerShown).toBe(false);
    expect(mockScreens.login.headerShown).toBe(false);
  });
});
