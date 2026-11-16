import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Forecast from '../app/(tabs)/index';
import Week from '../app/(tabs)/week';
import Courses from '../app/(tabs)/courses';
import Syllabus from '../app/syllabus';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const empty = { ...wallSemester, courses: [], tasks: [] };
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => { globalThis.fetch = mockFetch; mockFetch.mockReset(); mockPush.mockReset(); });
afterAll(() => { globalThis.fetch = originalFetch; });

it.each([Forecast, Week, Courses])('gives an empty tab a useful next step', async (Screen) => {
  mockFetch.mockResolvedValue(reply(200, empty));
  render(<SemesterProvider><Screen /></SemesterProvider>);
  expect(await screen.findByText('No courses yet')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try a sample semester' })).toBeTruthy();
  expect(screen.queryByTestId('week-hours')).toBeNull();
});
it('loads the sample into all tabs and prevents repeated taps while waiting', async () => {
  let finish!: (value: unknown) => void;
  mockFetch.mockResolvedValueOnce(reply(200, empty)).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<SemesterProvider><Forecast /><Week /><Courses /></SemesterProvider>);
  const buttons = await screen.findAllByRole('button', { name: 'Try a sample semester' });
  fireEvent.press(buttons[0]);
  expect(screen.getAllByRole('button', { name: 'Loading sample semester' }).every((button) => button.props.accessibilityState.disabled)).toBe(true);
  fireEvent.press(screen.getAllByRole('button', { name: 'Loading sample semester' })[1]);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => finish(reply(201, wallSemester)));
  expect(screen.queryByText('No courses yet')).toBeNull();
  expect(screen.getAllByText('CS 262').length).toBeGreaterThan(0);
});
it('shows the existing semester after a conflict', async () => {
  mockFetch.mockResolvedValueOnce(reply(200, empty)).mockResolvedValueOnce(reply(409, {})).mockResolvedValueOnce(reply(200, wallSemester));
  render(<SemesterProvider><Courses /></SemesterProvider>);
  fireEvent.press(await screen.findByRole('button', { name: 'Try a sample semester' }));
  expect(await screen.findByTestId('course-c1')).toBeTruthy();
  expect(screen.queryByText('No courses yet')).toBeNull();
});
it('stays empty after a refusal and allows another try', async () => {
  mockFetch.mockResolvedValueOnce(reply(200, empty)).mockResolvedValueOnce(reply(503, { error: 'Please try again later.' })).mockResolvedValueOnce(reply(201, wallSemester));
  render(<SemesterProvider><Courses /></SemesterProvider>);
  fireEvent.press(await screen.findByRole('button', { name: 'Try a sample semester' }));
  expect(await screen.findByText('Please try again later.')).toBeTruthy();
  expect(screen.getByText('No courses yet')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Try a sample semester' }));
  expect(await screen.findByTestId('course-c1')).toBeTruthy();
});
it('explains that a course comes before a syllabus without an empty picker', () => {
  render(<SemesterProvider initial={empty}><Syllabus /></SemesterProvider>);
  expect(screen.getByText('Add a course first')).toBeTruthy();
  expect(screen.queryByTestId('syllabus-input')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Go to Courses' }));
  expect(mockPush).toHaveBeenCalledWith('/courses');
  expect(mockFetch).not.toHaveBeenCalled();
});
it('keeps fixture mode on the device', () => {
  render(<SemesterProvider initial={empty}><Courses /></SemesterProvider>);
  expect(screen.queryByRole('button', { name: 'Try a sample semester' })).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});
