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

  for (const task of tasks) {
    const span = workSpan(task, totalWeeks);
    if (span === null) continue;

    for (let week = span.firstWeek; week <= span.lastWeek; week++) {
      hoursByWeek[week] += span.hoursPerWeek;
    }
  }

  const loads: WeekLoad[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    loads.push({ week, hours: hoursByWeek[week] });
  }
  return loads;
}

/** The weeks an outstanding task's work is projected into. */
export type WorkSpan = {
  firstWeek: number;
  lastWeek: number;
  hoursPerWeek: number;
};

/**
 * Where a task's hours land. Work ends in its due week and reaches back over
 * `spreadWeeks` weeks. If that would start before week 1, it is squeezed into
 * the weeks we have so the total number of hours is preserved.
 *
 * Null for work that puts nothing in the forecast: finished, unestimated, or
 * due outside the semester.
 */
export function workSpan(
  task: Task,
  totalWeeks: number = WEEKS_IN_SEMESTER
): WorkSpan | null {
  if (task.done) return null;
  if (task.estimatedHours === null || task.estimatedHours <= 0) return null;
  if (task.dueWeek < 1 || task.dueWeek > totalWeeks) return null;

  const spread = task.spreadWeeks ?? 1;
  const firstWeek = Math.max(1, task.dueWeek - spread + 1);
  const weeksUsed = task.dueWeek - firstWeek + 1;

  return {
    firstWeek,
    lastWeek: task.dueWeek,
    hoursPerWeek: task.estimatedHours / weeksUsed,
  };
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

/** How a week's projected hours sit against the student's capacity. */
export type LoadBand = 'calm' | 'moderate' | 'heavy';

/**
 * Calm is at or below two-thirds of capacity, moderate is above that up to
 * and including capacity, heavy is over capacity. A week exactly at capacity
 * fits, so it reads as moderate rather than as a crunch.
 *
 * The two-thirds test is done in whole multiples to avoid float rounding.
 */
export function loadBand(hours: number, capacity: number): LoadBand {
  if (hours > capacity) return 'heavy';
  if (hours * 3 > capacity * 2) return 'moderate';
  return 'calm';
}

/** Projected hours in one week, or 0 for a week that is not in `loads`. */
export function hoursInWeek(loads: WeekLoad[], week: number): number {
  return loads.find((load) => load.week === week)?.hours ?? 0;
}

/**
 * The first week, this one included, whose work does not fit in the
 * student's capacity. Null when every remaining week fits.
 */
export function nextWall(
  loads: WeekLoad[],
  weeklyCapacity: number,
  fromWeek: number
): WeekLoad | null {
  return (
    loads.find((load) => load.week >= fromWeek && load.hours > weeklyCapacity) ??
    null
  );
}

/**
 * Hours as shown to the student: rounded up to a whole number, so a week
 * that is over capacity never displays as exactly at capacity.
 */
export function wholeHours(hours: number): number {
  // Round to hundredths first so 4.0000000001 does not become 5.
  return Math.ceil(Math.round(hours * 100) / 100);
}

/** An assignment with the hours it puts into one particular week. */
export type WeekAssignment = { task: Task; hours: number };

/**
 * The outstanding assignments whose work lands in `week`, biggest share first
 * and alphabetical among equals so the order never shifts between renders.
 */
export function assignmentsInWeek(tasks: Task[], week: number): WeekAssignment[] {
  const found: WeekAssignment[] = [];

  for (const task of tasks) {
    const span = workSpan(task);
    if (span === null || week < span.firstWeek || week > span.lastWeek) continue;
    found.push({ task, hours: span.hoursPerWeek });
  }

  return found.sort(
    (a, b) => b.hours - a.hours || a.task.title.localeCompare(b.task.title)
  );
}

/** What to start, and when, to take pressure off a wall. */
export type StartRecommendation = {
  task: Task;
  /** The week to begin. At or before `currentWeek` means begin now. */
  startWeek: number;
};

/**
 * The week a task should begin, no later than: the week its work is already
 * spread from, or the week `startBy` gives, whichever is earlier. A task with
 * no estimate has nothing to plan from, so it begins in its due week.
 */
export function plannedStart(task: Task, weeklyCapacity: number): number {
  const span = workSpan(task);
  const latest = startBy(task, weeklyCapacity);
  if (span === null || latest === null) return task.dueWeek;
  return Math.min(span.firstWeek, latest);
}

/**
 * The single assignment most worth starting to ease the wall in `wallWeek`:
 * the one putting the most hours into that week, and the week to begin it.
 *
 * Null when nothing outstanding puts hours into the wall week.
 */
export function recommendStart(
  tasks: Task[],
  wallWeek: number,
  weeklyCapacity: number
): StartRecommendation | null {
  const [biggest] = assignmentsInWeek(tasks, wallWeek);
  if (biggest === undefined) return null;

  return {
    task: biggest.task,
    startWeek: plannedStart(biggest.task, weeklyCapacity),
  };
}

/**
 * The run of over-capacity weeks that includes `week`, or null if `week`
 * itself fits.
 */
export function crunchPeriodAt(
  loads: WeekLoad[],
  weeklyCapacity: number,
  week: number
): CrunchWindow | null {
  return (
    detectCrunch(loads, weeklyCapacity).find(
      (window) => window.startWeek <= week && week <= window.endWeek
    ) ?? null
  );
}

/**
 * Hours to one decimal place, for the parts of a week that add up to a bar.
 * Rounding each part up to a whole number would make them sum to more than
 * the week they belong to.
 */
export function exactHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

/** "1 hr", "2.5 hrs": an amount of work with the right unit. */
export function hoursLabel(hours: number): string {
  const amount = exactHours(hours);
  return `${amount} ${amount === 1 ? 'hr' : 'hrs'}`;
}
