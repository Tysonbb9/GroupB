import { CrunchWindow, Task, WeekLoad, WEEKS_IN_SEMESTER } from './types';

/**
 * Project how many hours of remaining work land in each week.
 *
 * Only work that is still outstanding counts. Finishing a task takes its
 * hours out of the forecast, which is the whole reward loop: the wall
 * comes down as you work.
 */
export function weeklyLoad(
  tasks: Task[],
  totalWeeks: number = WEEKS_IN_SEMESTER
): WeekLoad[] {
  const hoursByWeek = new Array<number>(totalWeeks + 1).fill(0);

  for (const t of tasks) {
    if (t.done) continue;
    if (t.estimatedHours === null || t.estimatedHours <= 0) continue;
    if (t.dueWeek < 1 || t.dueWeek > totalWeeks) continue;

    // Work ends in its due week and reaches back over spreadWeeks weeks.
    // If that would start before week 1, squeeze it into the weeks we have
    // so the total number of hours is preserved.
    const spread = t.spreadWeeks ?? 1;
    const firstWeek = Math.max(1, t.dueWeek - spread + 1);
    const weeksUsed = t.dueWeek - firstWeek + 1;
    const hoursPerWeek = t.estimatedHours / weeksUsed;

    for (let week = firstWeek; week <= t.dueWeek; week++) {
      hoursByWeek[week] += hoursPerWeek;
    }
  }

  const loads: WeekLoad[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    loads.push({ week, hours: hoursByWeek[week] });
  }
  return loads;
}

/**
 * Find the runs of weeks where projected work is more than the student
 * actually has time for. Weeks exactly at capacity are fine; it is only
 * a crunch when the work does not fit.
 */
export function detectCrunch(
  loads: WeekLoad[],
  weeklyCapacity: number
): CrunchWindow[] {
  const windows: CrunchWindow[] = [];
  let current: CrunchWindow | null = null;

  for (const load of loads) {
    const over = load.hours > weeklyCapacity;

    if (over && current === null) {
      current = {
        startWeek: load.week,
        endWeek: load.week,
        peakHours: load.hours,
      };
    } else if (over && current !== null) {
      current.endWeek = load.week;
      current.peakHours = Math.max(current.peakHours, load.hours);
    } else if (!over && current !== null) {
      windows.push(current);
      current = null;
    }
  }

  if (current !== null) windows.push(current);
  return windows;
}

/**
 * The week to start a task so it is finished by its due week, assuming the
 * student can give it their whole weekly capacity. Returns null when the
 * task has no estimate, because then there is nothing to reason from.
 */
export function startBy(task: Task, weeklyCapacity: number): number | null {
  if (task.estimatedHours === null) return null;
  if (task.estimatedHours <= 0) return task.dueWeek;

  const weeksNeeded = Math.ceil(task.estimatedHours / weeklyCapacity);
  return Math.max(1, task.dueWeek - weeksNeeded + 1);
}
