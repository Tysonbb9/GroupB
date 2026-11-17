import { checkTaskEdit, editTextFor } from './task-edit';
import { Task } from './types';

/**
 * US-44 (#159): the checks behind Save on an assignment's details. The same
 * rules as PATCH /tasks/:id, and only what changed is kept. The title is not
 * editable for now.
 */

const midterm: Task = { id: 'exam', courseId: 'c2', title: 'Midterm', dueWeek: 6, estimatedHours: 8, done: false };
const text = (dueWeek = '6', hours = '8') => ({ dueWeek, hours });

describe('editTextFor', () => {
  it('starts the boxes at the task as it is', () => {
    expect(editTextFor(midterm)).toEqual({ dueWeek: '6', hours: '8' });
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
    expect(checkTaskEdit(midterm, text('7'))).toEqual({ ok: true, change: { dueWeek: 7 } });
    expect(checkTaskEdit(midterm, text('6', '10'))).toEqual({ ok: true, change: { estimatedHours: 10 } });
    expect(checkTaskEdit(midterm, text('7', '10'))).toEqual({ ok: true, change: { dueWeek: 7, estimatedHours: 10 } });
  });

  it('clears the hours with a blank box', () => {
    expect(checkTaskEdit(midterm, text('6', ''))).toEqual({ ok: true, change: { estimatedHours: null } });
  });

  it.each(['0', '16', '-1', '2.5', 'six', '', ' '])('refuses week %p', (week) => {
    expect(checkTaskEdit(midterm, text(week))).toEqual({
      ok: false,
      problem: 'The due week must be a whole number from 1 to 15.',
    });
  });

  it.each(['1', '15', ' 9 '])('accepts week %p', (week) => {
    expect(checkTaskEdit(midterm, text(week)).ok).toBe(true);
  });

  it.each(['0', '101', 'abc', '-2'])('refuses hours %p', (hours) => {
    expect(checkTaskEdit(midterm, text('6', hours))).toEqual({
      ok: false,
      problem: 'Enter hours more than 0 and up to 100, or leave them blank.',
    });
  });

  it('checks the week before the hours', () => {
    expect(checkTaskEdit(midterm, text('99', 'abc'))).toMatchObject({ problem: /due week/ });
  });
});
