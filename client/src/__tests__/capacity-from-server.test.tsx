import { render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import { fetchSemester } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../lib/api', () => ({ fetchSemester: jest.fn() }));
const mockFetchSemester = jest.mocked(fetchSemester);

/**
 * US-02 once the data comes from the server: the hours available are
 * whatever the server says, not a number built into the app. wallSemester has
 * a capacity of 10, which no other source in the app uses.
 */
describe('US-02: weekly capacity comes from the server', () => {
  beforeEach(() => {
    mockFetchSemester.mockReset();
    mockFetchSemester.mockResolvedValue(wallSemester);
  });

  it('states the hours available that the server sent', async () => {
    render(
      <SemesterProvider>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(await screen.findByTestId('figure-this-week')).toHaveTextContent(/\/ 10 hrs/);
  });

  it('names that capacity beside the dashed line', async () => {
    render(
      <SemesterProvider>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(await screen.findByText('Dashed line is your 10 hours a week')).toBeTruthy();
  });
});
