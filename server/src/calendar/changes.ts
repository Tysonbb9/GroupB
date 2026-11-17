import type { CalendarImport, Task } from '../types';
import type { CalendarEvent } from './ics';
import { weekOf } from './proposals';

/**
 * US-50 (#166): what changed in a Moodle calendar since its events were added.
 *
 * Each event the student added was recorded with its week (#165). Comparing
 * that record with a fresh copy of the calendar finds:
 *
 *  - moved:   the event is still there, in another semester week, and
 *  - removed: the event is gone, or now falls outside weeks 1 to 15.
 *
 * New events are not changes; they are the review from #165. Nothing here
 * changes anything: the student accepts each change first (routes.ts).
 */

export type CalendarChange =
  | { kind: 'moved'; eventId: string; taskId: string; title: string; fromWeek: number; toWeek: number }
  | { kind: 'removed'; eventId: string; taskId: string; title: string; week: number };

/**
 * The changes to show, soonest first. An added event whose task the student
 * has since deleted is left out: there is nothing left to change.
 */
export function findChanges(
  events: CalendarEvent[],
  imports: CalendarImport[],
  tasks: Pick<Task, 'id' | 'title' | 'dueWeek'>[],
  start: Date
): CalendarChange[] {
  const byId = new Map(events.map((event) => [event.uid, event]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const changes: CalendarChange[] = [];

  for (const row of imports) {
    const task = taskById.get(row.taskId);
    if (!task) continue;

    const event = byId.get(row.eventId);
    const week = event ? weekOf(event.start, start) : null;
    if (week === null) {
      changes.push({ kind: 'removed', eventId: row.eventId, taskId: task.id, title: task.title, week: task.dueWeek });
    } else if (week !== row.dueWeek) {
      changes.push({ kind: 'moved', eventId: row.eventId, taskId: task.id, title: task.title, fromWeek: row.dueWeek, toWeek: week });
    }
  }

  const weekOfChange = (change: CalendarChange) => (change.kind === 'moved' ? change.toWeek : change.week);
  return changes.sort((a, b) => weekOfChange(a) - weekOfChange(b) || a.title.localeCompare(b.title));
}
