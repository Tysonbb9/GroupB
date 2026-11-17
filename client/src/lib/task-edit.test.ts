import { checkTaskEdit, editTextFor } from './task-edit';
import { Task } from './types';

/**
 * US-44 (#159): the checks behind Save on an assignment's details. The same
 * rules as PATCH /tasks/:id, and only what changed is kept.
 */

const midterm: Task = { id: 'exam', courseId: 'c2', title: 'Midterm', dueWeek: 6, estimatedHours: 8, done: false };
const text = (title = 'Midterm', dueWeek = '6', hours = '8') => ({ title, dueWeek, hours });

describe('editTextFor', () => {
  it('starts the boxes at the task as it is', () => {
    expect(editTextFor(midterm)).toEqual({ title: 'Midterm', dueWeek: '6', hours: '8' });
  });

  it('leaves the hours box empty when the task has none', () => {
    expect(editTextFor({ ...midterm, estimatedHours: null }).hours).toBe('');
  });
});

describe('checkTaskEdit', () => {
  it('is an empty change when nothing differs', () => {
    expect(checkTaskEdit(midterm, text())).toEqual({ ok: true, change: {} });
  });

  it('keeps only the fields that changed', () => {
    expect(checkTaskEdit(midterm, text('Midterm 1'))).toEqual({ ok: true, change: { title: 'Midterm 1' } });
    expect(checkTaskEdit(midterm, text('Midterm', '7'))).toEqual({ ok: true, change: { dueWeek: 7 } });
    expect(checkTaskEdit(midterm, text('Midterm', '6', '10'))).toEqual({ ok: true, change: { estimatedHours: 10 } });
  });

  it('trims the title, and a title that only gained spaces has not changed', () => {
    expect(checkTaskEdit(midterm, text('  Midterm  '))).toEqual({ ok: true, change: {} });
    expect(checkTaskEdit(midterm, text(' Exam '))).toEqual({ ok: true, change: { title: 'Exam' } });
  });

  it('clears the hours with a blank box', () => {
    expect(checkTaskEdit(midterm, text('Midterm', '6', ''))).toEqual({ ok: true, change: { estimatedHours: null } });
  });

  it.each(['', '  '])('refuses a blank title (%p)', (title) => {
    expect(checkTaskEdit(midterm, text(title))).toEqual({ ok: false, problem: 'Give the assignment a title.' });
  });

  it.each(['0', '16', '-1', '2.5', 'six', '', ' '])('refuses week %p', (week) => {
    expect(checkTaskEdit(midterm, text('Midterm', week))).toEqual({
      ok: false,
      problem: 'The due week must be a whole number from 1 to 15.',
    });
  });

  it.each(['1', '15', ' 9 '])('accepts week %p', (week) => {
    expect(checkTaskEdit(midterm, text('Midterm', week)).ok).toBe(true);
  });

  it.each(['0', '101', 'abc', '-2'])('refuses hours %p', (hours) => {
    expect(checkTaskEdit(midterm, text('Midterm', '6', hours))).toEqual({
      ok: false,
      problem: 'Enter hours more than 0 and up to 100, or leave them blank.',
    });
  });

  it('checks the title first, then the week, then the hours', () => {
    expect(checkTaskEdit(midterm, text('', '99', 'abc'))).toMatchObject({ problem: 'Give the assignment a title.' });
    expect(checkTaskEdit(midterm, text('X', '99', 'abc'))).toMatchObject({ problem: /due week/ });
  });
});
