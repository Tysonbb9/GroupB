import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SemesterScreen from '../app/(tabs)/index';
import LoginScreen from '../app/login';
import { SemesterProvider } from '../state/semester-store';
import { SessionProvider, useSession } from '../state/session';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** Shows who is signed in, so a test can see what the screen did to the session. */
function SignedInAs() {
  const { email } = useSession();
  return <Text testID="signed-in-as">{email ?? 'nobody'}</Text>;
}

function renderLogin() {
  return render(
    <SessionProvider>
      <LoginScreen />
      <SignedInAs />
    </SessionProvider>
  );
}

function fillIn(email: string, password: string) {
  fireEvent.changeText(screen.getByTestId('login-email'), email);
  fireEvent.changeText(screen.getByTestId('login-password'), password);
  fireEvent.press(screen.getByTestId('login-submit'));
}

describe('US-27: the login screen', () => {
  it('shows a simple email and password form', () => {
    renderLogin();

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toHaveTextContent('Log in');
  });

  it('hides the password characters', () => {
    renderLogin();
    expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true);
  });

  it('lets students show and hide the password without changing its value', () => {
    renderLogin();
    fireEvent.changeText(screen.getByTestId('login-password'), 'example-password');

    expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('login-password').props.value).toBe('example-password');

    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('login-password').props.value).toBe('example-password');
  });

  it('asks for both fields, and does not sign in without them', () => {
    renderLogin();
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByText('Please enter your email and password.')).toBeTruthy();
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('nobody');
  });

  it('checks that the email looks valid, and does not sign in until it does', () => {
    renderLogin();
    fillIn('not-an-email', 'example-password');

    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('nobody');
  });

  it('signs in with a valid email and password', async () => {
    renderLogin();
    fillIn('  student@example.edu ', 'example-password');

    expect(await screen.findByText('student@example.edu')).toBeTruthy();
  });

  it('says plainly, in sample-data mode, that any email and password work', () => {
    renderLogin();
    expect(screen.getByTestId('login-note')).toHaveTextContent(
      /Sample data: any email and password open the app/
    );
  });
});

describe('Log out', () => {
  it('signs the student out from Forecast', () => {
    render(
      <SessionProvider initialEmail="student@example.edu">
        <SemesterProvider initial={wallSemester}>
          <SemesterScreen />
        </SemesterProvider>
        <SignedInAs />
      </SessionProvider>
    );

    fireEvent.press(screen.getByLabelText('Log out student@example.edu'));
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('nobody');
  });

  it('is not drawn when the screen has no session around it', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(screen.queryByTestId('log-out')).toBeNull();
  });
});
