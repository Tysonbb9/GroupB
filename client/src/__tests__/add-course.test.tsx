import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text, Pressable } from 'react-native';
import AddCourseScreen from '../app/add-course';
import CoursesScreen from '../app/(tabs)/courses';
import SyllabusScreen from '../app/syllabus';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';
import { searchCatalog, enrollInCourse, createCourse } from '../lib/api';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }));
const course = { id: 'new', code: 'CS 300', name: 'Algorithms', attendance: null };
const mockFetch = jest.fn();
function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function Count() {
  const { semester, addCourse } = useSemester();
  return <><Text testID="count">{semester.courses.length}</Text>
    <Pressable accessibilityLabel="Add same twice" onPress={() => { addCourse(course); addCourse(course); }} /></>;
}
function setup() {
  return render(<SemesterProvider initial={wallSemester}><AddCourseScreen /><Count /></SemesterProvider>);
}
async function search(q = 'cs300') {
  fireEvent.changeText(screen.getByLabelText('Search courses'), q);
  await act(async () => { jest.advanceTimersByTime(250); });
}
beforeEach(() => {
  jest.useFakeTimers();
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
  mockBack.mockReset();
  mockPush.mockReset();
  delete process.env.EXPO_PUBLIC_USE_FIXTURE;
});
afterEach(() => { jest.useRealTimers(); delete process.env.EXPO_PUBLIC_USE_FIXTURE; });

it.each(['cs262', 'CS 262', 'cs-262'])('sends the typed query %s and lists results', async (q) => {
  mockFetch.mockResolvedValue(response(200, [{ ...course, enrolled: false }]));
  setup();
  await search(q);
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/catalog?q=' + encodeURIComponent(q)), expect.anything());
  expect(screen.getByText('Algorithms')).toBeTruthy();
});
it('debounces input and ignores answers from an older query, including its failure', async () => {
  let resolveOld!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]));
  setup();
  fireEvent.changeText(screen.getByLabelText('Search courses'), 'old');
  expect(mockFetch).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(250); });
  await search('new');
  await act(async () => { resolveOld(response(500, { error: 'Old error' })); });
  expect(screen.getByText('Algorithms')).toBeTruthy();
  expect(screen.queryByText('Old error')).toBeNull();
});
it('joins a match and updates Courses and Add a Syllabus immediately', async () => {
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]))
    .mockResolvedValueOnce(response(200, course));
  setup();
  await search();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId('count').props.children).toBe(3);
  screen.unmount();
  // The same mounted provider also supplies both consuming screens.
  mockFetch.mockImplementation((url: string) => Promise.resolve(response(200,
    url.endsWith('/ai/status') ? { available: false } :
    url.includes('/catalog?') ? [{ ...course, enrolled: false }] : course)));
  render(<SemesterProvider initial={wallSemester}><AddCourseScreen /><CoursesScreen /><SyllabusScreen /></SemesterProvider>);
  await search();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  await waitFor(() => expect(screen.getByLabelText('Choose CS 300')).toBeTruthy());
  expect(screen.getAllByText('Algorithms').length).toBeGreaterThan(1);
});
it('marks courses already joined and keeps repeated additions unique', async () => {
  mockFetch.mockResolvedValue(response(200, [{ ...course, enrolled: true }]));
  setup();
  await search();
  expect(screen.getByText('Already yours')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Add same twice'));
  expect(screen.getByTestId('count').props.children).toBe(3);
});
it('prefills the code and creates a course', async () => {
  mockFetch.mockResolvedValueOnce(response(200, [])).mockResolvedValueOnce(response(201, course));
  setup(); await search('CS 300');
  fireEvent.press(screen.getByText('Create a new course'));
  expect(screen.getByLabelText('Course code').props.value).toBe('CS 300');
  fireEvent.changeText(screen.getByLabelText('Course name'), 'Algorithms');
  fireEvent.press(screen.getByText('Save course'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(screen.getByTestId('count').props.children).toBe(3);
});
it('offers an explicit Join after a duplicate instead of adding it automatically', async () => {
  mockFetch.mockResolvedValueOnce(response(200, []))
    .mockResolvedValueOnce(response(409, { error: 'Code exists', course }))
    .mockResolvedValueOnce(response(200, course));
  setup(); await search();
  fireEvent.press(screen.getByText('Create a new course'));
  fireEvent.changeText(screen.getByLabelText('Course name'), 'Something else');
  fireEvent.press(screen.getByText('Save course'));
  await waitFor(() => expect(screen.getByLabelText('Join CS 300')).toBeTruthy());
  expect(screen.getByTestId('count').props.children).toBe(2);
  expect(mockBack).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(screen.getByTestId('count').props.children).toBe(3);
});
it('shows the server failure and changes nothing', async () => {
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]))
    .mockResolvedValueOnce(response(500, { error: 'Please try later' }));
  setup(); await search();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  await waitFor(() => expect(screen.getByText('Please try later')).toBeTruthy());
  expect(screen.getByTestId('count').props.children).toBe(2);
  expect(mockBack).not.toHaveBeenCalled();
});
it('clears matches immediately and never sends a blank search', async () => {
  mockFetch.mockResolvedValue(response(200, [{ ...course, enrolled: false }]));
  setup(); await search();
  await search(' ');
  expect(screen.queryByText('Algorithms')).toBeNull();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
it('explains fixture mode and hides its entry button without calling the server', () => {
  process.env.EXPO_PUBLIC_USE_FIXTURE = '1';
  setup();
  expect(screen.getByText('Adding courses needs a server connection. Sample data cannot be changed here.')).toBeTruthy();
  expect(screen.queryByLabelText('Search courses')).toBeNull();
  screen.unmount();
  render(<SemesterProvider initial={wallSemester}><CoursesScreen /></SemesterProvider>);
  expect(screen.queryByText('Add a course')).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});
it('opens from Courses', () => {
  render(<SemesterProvider initial={wallSemester}><CoursesScreen /></SemesterProvider>);
  fireEvent.press(screen.getByText('Add a course'));
  expect(mockPush).toHaveBeenCalledWith('/add-course');
});
it('rejects malformed catalog and course responses', async () => {
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: 'yes' }]));
  await expect(searchCatalog('cs')).rejects.toThrow('invalid course');
  mockFetch.mockResolvedValueOnce(response(200, { ...course, attendance: {} }));
  await expect(enrollInCourse('a/b')).rejects.toThrow('invalid course');
  expect(mockFetch.mock.calls[1][0]).toContain('/courses/a%2Fb/enroll');
  mockFetch.mockResolvedValueOnce(response(409, { course: { id: 'bad' } }));
  await expect(createCourse({ code: 'a', name: 'b' })).rejects.toThrow('invalid course');
});


it('ignores an older successful search after a newer one and after clearing', async () => {
  let resolveOld!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]));
  setup(); await search('old'); await search('new');
  await act(async () => { resolveOld(response(200, [{ ...course, id: 'old', name: 'Old name', enrolled: false }])); });
  expect(screen.queryByText('Old name')).toBeNull();
  expect(screen.getByText('Algorithms')).toBeTruthy();
  let resolvePending!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolvePending = resolve; }));
  await search('pending'); await search('');
  await act(async () => { resolvePending(response(200, [{ ...course, enrolled: false }])); });
  expect(screen.queryByText('Algorithms')).toBeNull();
});
it('shows progress and prevents double enrollment while saving', async () => {
  let resolveJoin!: (value: unknown) => void;
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveJoin = resolve; }));
  setup(); await search();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  expect(screen.getByText('Saving course...')).toBeTruthy();
  expect(screen.getByLabelText('Search courses').props.editable).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => { resolveJoin(response(200, course)); });
  expect(mockBack).toHaveBeenCalledTimes(1);
});
it('shows search failures and permits another query', async () => {
  mockFetch.mockResolvedValueOnce(response(500, { error: 'Catalog unavailable' }))
    .mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]));
  setup(); await search();
  expect(screen.getByText('Catalog unavailable')).toBeTruthy();
  expect(screen.getByTestId('count').props.children).toBe(2);
  await search('new');
  expect(screen.queryByText('Catalog unavailable')).toBeNull();
  expect(screen.getByText('Algorithms')).toBeTruthy();
});
it('shows refused creation without changing courses and allows retry', async () => {
  mockFetch.mockResolvedValueOnce(response(200, []))
    .mockResolvedValueOnce(response(400, { error: 'Code must be at most 40 characters' }))
    .mockResolvedValueOnce(response(201, course));
  setup(); await search();
  fireEvent.press(screen.getByText('Create a new course'));
  fireEvent.changeText(screen.getByLabelText('Course name'), 'Algorithms');
  fireEvent.press(screen.getByText('Save course'));
  await waitFor(() => expect(screen.getByText('Code must be at most 40 characters')).toBeTruthy());
  expect(screen.getByTestId('count').props.children).toBe(2);
  expect(mockBack).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Course code'), 'CS 300');
  fireEvent.press(screen.getByText('Save course'));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
});
it('does not finish navigation if a pending enrollment resolves after leaving', async () => {
  let resolveJoin!: (value: unknown) => void;
  mockFetch.mockResolvedValueOnce(response(200, [{ ...course, enrolled: false }]))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveJoin = resolve; }));
  setup(); await search();
  fireEvent.press(screen.getByLabelText('Join CS 300'));
  screen.unmount();
  await act(async () => { resolveJoin(response(200, course)); });
  expect(mockBack).not.toHaveBeenCalled();
});
it('reports an unreachable server without adding a course', async () => {
  mockFetch.mockRejectedValueOnce(new Error('connection closed'));
  setup(); await search();
  expect(screen.getByText(/Could not reach the server/)).toBeTruthy();
  expect(screen.getByTestId('count').props.children).toBe(2);
});
