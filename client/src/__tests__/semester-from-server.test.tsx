import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { fetchSemester } from '../lib/api';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('../lib/api', () => ({ fetchSemester: jest.fn() }));
const mockFetchSemester = jest.mocked(fetchSemester);

/** Stands in for a screen: shows that the provider handed it the semester. */
function SemesterLabel() {
  return <Text>{useSemester().semester.label}</Text>;
}

beforeEach(() => {
  mockFetchSemester.mockReset();
});

describe('#56: the app loads its semester from the server', () => {
  it('shows a loading indicator, then the app once the semester arrives', async () => {
    mockFetchSemester.mockResolvedValue(wallSemester);
    render(
      <SemesterProvider>
        <SemesterLabel />
      </SemesterProvider>
    );

    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.queryByText('Fall 2026')).toBeNull();

    expect(await screen.findByText('Fall 2026')).toBeTruthy();
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('shows what went wrong when the server cannot be reached', async () => {
    mockFetchSemester.mockRejectedValue(new Error('Could not reach the server at http://x:3000'));
    render(
      <SemesterProvider>
        <SemesterLabel />
      </SemesterProvider>
    );

    expect(await screen.findByText('Could not reach the server at http://x:3000')).toBeTruthy();
    expect(screen.queryByText('Fall 2026')).toBeNull();
  });

  it('asks the server again when the user presses Try again', async () => {
    mockFetchSemester
      .mockRejectedValueOnce(new Error('Could not reach the server at http://x:3000'))
      .mockResolvedValueOnce(wallSemester);
    render(
      <SemesterProvider>
        <SemesterLabel />
      </SemesterProvider>
    );

    await screen.findByTestId('error-message');
    fireEvent.press(screen.getByTestId('retry'));

    expect(await screen.findByText('Fall 2026')).toBeTruthy();
    expect(screen.queryByTestId('error-message')).toBeNull();
    expect(mockFetchSemester).toHaveBeenCalledTimes(2);
  });

  it('does not touch the server when the caller supplies a semester', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterLabel />
      </SemesterProvider>
    );

    expect(screen.getByText('Fall 2026')).toBeTruthy();
    expect(mockFetchSemester).not.toHaveBeenCalled();
  });
});
