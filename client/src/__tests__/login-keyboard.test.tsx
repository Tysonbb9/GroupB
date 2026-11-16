import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, ScrollView, StyleSheet } from 'react-native';
import LoginScreen from '../app/login';
import { Auth, AuthResult } from '../lib/auth';
import { SessionProvider } from '../state/session';
import { theme } from '../theme';

/**
 * Issue #157: on a phone the keyboard covers the login error, so a wrong
 * password looked like nothing happened. The message sits at the top of the
 * form, above every field, so a field tapped again to fix the mistake never
 * pushes it under the keyboard. It is red, and the keyboard closes when it
 * arrives.
 * A stand-in plays the server, so no server is needed.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** An auth that refuses every sign-in and sign-up with the server's own words. */
function refusingAuth(message = 'Invalid email or password'): Auth {
  const refuse = jest.fn(async (): Promise<AuthResult> => ({ ok: false, message }));
  return {
    checksPasswords: true,
    restore: jest.fn(() => Promise.resolve(null)),
    signIn: refuse,
    signUp: refuse,
    signOut: jest.fn(() => Promise.resolve()),
    requestOptions: jest.fn(() => Promise.resolve({})),
  } satisfies Auth;
}

async function renderLogin(auth: Auth = refusingAuth()) {
  render(
    <SessionProvider auth={auth}>
      <LoginScreen />
    </SessionProvider>
  );
  await act(async () => {}); // lets the check for a saved session finish
}

/** The test ids on the screen, in the order they are drawn. */
function testIdsInOrder(): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const element = node as { props?: { testID?: string }; children?: unknown };
    if (element.props?.testID) ids.push(element.props.testID);
    walk(element.children);
  };
  walk(screen.toJSON());
  return ids;
}

let dismiss: jest.SpyInstance;

beforeEach(() => {
  dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});

afterEach(() => {
  dismiss.mockRestore();
});

describe('the keyboard and the login message', () => {
  it('closes the keyboard and shows the server\'s refusal when a sign-in is refused', async () => {
    await renderLogin();
    fireEvent.changeText(screen.getByTestId('login-email'), 'sam@example.edu');
    fireEvent.changeText(screen.getByTestId('login-password'), 'wrong-password');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });

    expect(screen.getByTestId('login-message')).toHaveTextContent('Invalid email or password');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('closes the keyboard for a refused Create account too', async () => {
    await renderLogin(refusingAuth('User already exists. Use another email.'));
    fireEvent.press(screen.getByTestId('switch-mode'));
    fireEvent.changeText(screen.getByTestId('login-name'), 'Sam');
    fireEvent.changeText(screen.getByTestId('login-email'), 'sam@example.edu');
    fireEvent.changeText(screen.getByTestId('login-password'), 'password-123');
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });

    expect(screen.getByTestId('login-message')).toHaveTextContent('User already exists. Use another email.');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('closes the keyboard for a problem found before asking the server', async () => {
    await renderLogin();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit')); // nothing typed
    });

    expect(screen.getByTestId('login-message')).toHaveTextContent('Please enter your email and password.');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('does not close the keyboard just by opening the screen', async () => {
    await renderLogin();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('draws the message above every field, so a field tapped again cannot push it under the keyboard', async () => {
    await renderLogin();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });

    const ids = testIdsInOrder();
    expect(ids.indexOf('login-message')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('login-message')).toBeLessThan(ids.indexOf('login-email'));
    expect(ids.indexOf('login-message')).toBeLessThan(ids.indexOf('login-password'));
  });

  it('draws the message above the name field too, on Create account', async () => {
    await renderLogin();
    fireEvent.press(screen.getByTestId('switch-mode'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });

    const ids = testIdsInOrder();
    expect(ids.indexOf('login-message')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('login-message')).toBeLessThan(ids.indexOf('login-name'));
  });

  it('draws the message in red, not in the quiet link colour', async () => {
    await renderLogin();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-submit'));
    });

    expect(StyleSheet.flatten(screen.getByTestId('login-message').props.style).color).toBe(theme.heavy);
  });

  it('lets a drag close the keyboard and keeps the form clear of it', async () => {
    await renderLogin();
    const scroll = screen.UNSAFE_getByType(ScrollView);

    expect(scroll.props.keyboardDismissMode).toBe('on-drag');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled'); // taps on the button still work
  });
});
