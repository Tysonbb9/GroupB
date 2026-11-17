import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { DraftBlocker, DraftCard } from '../components/DraftCard';
import type { Draft } from '../lib/review';

beforeAll(async () => { await Font.loadAsync(Ionicons.font); });

const good: Draft = { title: 'Prototype demo', week: '4', hours: '6' };
function card(over: Partial<React.ComponentProps<typeof DraftCard>> = {}) {
  const onChange = jest.fn(), onRemove = jest.fn();
  render(<DraftCard draft={good} index={0} onChange={onChange} onRemove={onRemove} {...over} />);
  return { onChange, onRemove };
}

it('marks a valid draft ready without changing its labelled fields', () => {
  card();
  expect(screen.getByLabelText('Assignment 1: ready to add')).toBeTruthy();
  expect(screen.getByLabelText('Title of assignment 1').props.value).toBe('Prototype demo');
  expect(screen.getByLabelText('Due week of assignment 1').props.value).toBe('4');
  expect(screen.getByLabelText('Estimated hours of assignment 1').props.value).toBe('6');
});
it('explains a missing week with a notice and a warning status', () => {
  card({ draft: { ...good, week: '' } });
  expect(screen.getByTestId('draft-week-hint-0')).toHaveTextContent('The syllabus does not say which week. Enter it before adding.');
  expect(screen.getByLabelText('Assignment 1: needs review')).toBeTruthy();
});
it('shows the non-blocking duplicate hint with a review status', () => {
  card({ duplicateHint: 'Already in your semester for CS 262, week 4.' });
  expect(screen.getByTestId('draft-duplicate-hint-0')).toHaveTextContent('Already in your semester for CS 262, week 4.');
  expect(screen.getByLabelText('Assignment 1: needs review')).toBeTruthy();
});
it('shows the saved validation error instead of the blank-week hint', () => {
  card({ draft: { ...good, week: '' }, error: 'The week must be a whole number from 1 to 15.' });
  expect(screen.getByText('The week must be a whole number from 1 to 15.')).toBeTruthy();
  expect(screen.queryByTestId('draft-week-hint-0')).toBeNull();
  expect(screen.getByLabelText('Assignment 1: needs review')).toBeTruthy();
});
it('keeps a long editable title whole and allows it to wrap', () => {
  const title = 'Research proposal and annotated bibliography for the semester-long software project';
  card({ draft: { ...good, title } });
  const input = screen.getByTestId('draft-title-0');
  expect(input.props.value).toBe(title);
  expect(input.props.multiline).toBe(true);
});
it('keeps field editing and the item-specific Remove action', () => {
  const { onChange, onRemove } = card();
  fireEvent.changeText(screen.getByTestId('draft-week-0'), '7');
  expect(onChange).toHaveBeenCalledWith('week', '7');
  fireEvent.press(screen.getByRole('button', { name: 'Remove Prototype demo' }));
  expect(onRemove).toHaveBeenCalledTimes(1);
});
it('warns about an invalid nonblank value before Add is pressed', () => {
  card({ draft: { ...good, week: '16' } });
  expect(screen.getByLabelText('Assignment 1: needs review')).toBeTruthy();
});
it('names a single missing week below Add', () => {
  render(<DraftBlocker drafts={[{ ...good, week: '' }]} />);
  expect(screen.getByText('1 assignment needs a week before it can be added.')).toBeTruthy();
});
it('names multiple missing weeks below Add', () => {
  render(<DraftBlocker drafts={[{ ...good, week: '' }, { ...good, week: '' }]} />);
  expect(screen.getByText('2 assignments need a week before they can be added.')).toBeTruthy();
});
it('uses the fixing summary when a missing week is not the only problem', () => {
  render(<DraftBlocker drafts={[{ ...good, week: '' }, { ...good, hours: '-1' }]} />);
  expect(screen.getByText('2 assignments need fixing before they can be added.')).toBeTruthy();
});
it('does not claim only a week is missing when the title or hours also need fixing', () => {
  render(<DraftBlocker drafts={[{ title: '', week: '', hours: '' }]} />);
  expect(screen.getByText('1 assignment needs fixing before it can be added.')).toBeTruthy();
});
it.each([{ drafts: [] }, { drafts: [good] }])('hides the blocker when no assignment needs fixing: %j', ({ drafts }) => {
  render(<DraftBlocker drafts={drafts} />);
  expect(screen.queryByTestId('syllabus-blocker')).toBeNull();
});
it('keeps a title on one line when Return is pressed or text is pasted', () => {
  const { onChange } = card();
  fireEvent.changeText(screen.getByLabelText('Title of assignment 1'), 'Lab\nreport');
  expect(onChange).toHaveBeenLastCalledWith('title', 'Lab report');
  fireEvent.changeText(screen.getByLabelText('Title of assignment 1'), 'Final\r\n\nproject');
  expect(onChange).toHaveBeenLastCalledWith('title', 'Final project');
});
it('finishes editing the title on Return instead of adding a line', () => {
  card();
  expect(screen.getByLabelText('Title of assignment 1').props.submitBehavior).toBe('blurAndSubmit');
});
