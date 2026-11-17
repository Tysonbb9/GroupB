import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Welcome } from '../components/Welcome';

/**
 * US-47 (#162): the welcome's three steps on their own. Where it opens, and
 * that it opens only once, is in first-run.test.tsx.
 */
function renderWelcome(capacity = 15) {
  const onSaveHours = jest.fn<Promise<void>, [number]>(() => Promise.resolve());
  const onAddCourse = jest.fn();
  const onClose = jest.fn();
  render(<Welcome capacity={capacity} onSaveHours={onSaveHours} onAddCourse={onAddCourse} onClose={onClose} />);
  return { onSaveHours, onAddCourse, onClose };
}

describe('The welcome (US-47)', () => {
  it('opens on step 1, saying what the app does', () => {
    renderWelcome();
    expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 1 of 3');
    expect(screen.getByText('Plan your weeks before they get heavy')).toBeTruthy();
  });

  it('can be skipped from the first step', () => {
    const { onClose, onSaveHours } = renderWelcome();
    fireEvent.press(screen.getByTestId('welcome-skip'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaveHours).not.toHaveBeenCalled();
  });

  it('asks for the hours a week on step 2, starting from the hours the student has now', () => {
    renderWelcome(15);
    fireEvent.press(screen.getByTestId('welcome-next'));
    expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 2 of 3');
    expect(screen.getByTestId('welcome-hours').props.value).toBe('15');
  });

  it('keeps the new hours and moves on to step 3', async () => {
    const { onSaveHours } = renderWelcome(15);
    fireEvent.press(screen.getByTestId('welcome-next'));
    fireEvent.changeText(screen.getByTestId('welcome-hours'), '20');
    fireEvent.press(screen.getByTestId('welcome-save-hours'));

    await waitFor(() => expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 3 of 3'));
    expect(onSaveHours).toHaveBeenCalledWith(20);
  });

  it('moves on without saving when the hours did not change', async () => {
    const { onSaveHours } = renderWelcome(15);
    fireEvent.press(screen.getByTestId('welcome-next'));
    fireEvent.press(screen.getByTestId('welcome-save-hours'));

    await waitFor(() => expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 3 of 3'));
    expect(onSaveHours).not.toHaveBeenCalled();
  });

  it('stays on step 2 and says why when the hours are not whole hours in range', () => {
    const { onSaveHours } = renderWelcome();
    fireEvent.press(screen.getByTestId('welcome-next'));
    fireEvent.changeText(screen.getByTestId('welcome-hours'), 'lots');
    fireEvent.press(screen.getByTestId('welcome-save-hours'));

    expect(screen.getByTestId('welcome-hours-problem')).toHaveTextContent(/Enter whole hours/);
    expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 2 of 3');
    expect(onSaveHours).not.toHaveBeenCalled();
  });

  it('stays on step 2 when the hours could not be saved', async () => {
    const { onSaveHours } = renderWelcome(15);
    onSaveHours.mockRejectedValueOnce(new Error('offline'));
    fireEvent.press(screen.getByTestId('welcome-next'));
    fireEvent.changeText(screen.getByTestId('welcome-hours'), '20');
    fireEvent.press(screen.getByTestId('welcome-save-hours'));

    expect(await screen.findByText('Could not save. Your hours are still 15.')).toBeTruthy();
    expect(screen.getByTestId('welcome-step')).toHaveTextContent('Step 2 of 3');
  });

  it('points to Add a course on step 3, or lets the student leave for later', async () => {
    const { onAddCourse, onClose } = renderWelcome(15);
    fireEvent.press(screen.getByTestId('welcome-next'));
    fireEvent.press(screen.getByTestId('welcome-save-hours'));
    await screen.findByTestId('welcome-add-course');

    expect(screen.queryByTestId('welcome-skip')).toBeNull();
    fireEvent.press(screen.getByTestId('welcome-add-course'));
    expect(onAddCourse).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('welcome-later'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
