import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import LoginScreen from '../app/login';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

describe('US-27: visit the login screen', () => {
  it('has a Log in link on the Semester screen', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );

    fireEvent.press(screen.getByTestId('go-to-login'));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('shows a simple email and password form', () => {
    render(<LoginScreen />);

    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByTestId('login-submit')).toHaveTextContent('Log in');
  });

  it('hides the password characters', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-password').props.secureTextEntry).toBe(true);
  });

  it('asks for both fields before continuing', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByText('Please enter your email and password.')).toBeTruthy();
  });

  it('checks that the email looks valid', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-email'), 'not-an-email');
    fireEvent.changeText(screen.getByTestId('login-password'), 'example-password');
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
  });

  it('does not pretend to authenticate without a backend', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByTestId('login-email'), 'student@example.edu');
    fireEvent.changeText(screen.getByTestId('login-password'), 'example-password');
    fireEvent.press(screen.getByTestId('login-submit'));

    expect(screen.getByTestId('login-message')).toHaveTextContent(
  'Sign-in is not connected yet. This is a preview of the login screen.'
);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
