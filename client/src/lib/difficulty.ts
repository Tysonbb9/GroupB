import { Course, Semester } from './types';
import { weeklyLoad } from './workload';

/** A course creates a spike when it needs more than 30% of weekly capacity. */
export const SPIKE_SHARE = 0.3;

/** Include the current week and the following three weeks in heads-up notices. */
export const LOOKAHEAD_WEEKS = 3;

export type CourseSpike = {
  week: number;
  hours: number;
};

export type CourseSpikeSummary = {
  course: Course;
  peakWeek: number | null;
  peakHours: number;
  spikes: CourseSpike[];
};

export type UpcomingSpike = CourseSpike & {
  course: Course;
};

/**
 * Summarize the weeks when each course alone needs a large share of capacity.
 * Hours come from weeklyLoad, so completed and unestimated work is excluded and
 * multi-week work is spread in exactly the same way as the semester chart.
 */
export function courseSpikes(semester: Semester): CourseSpikeSummary[] {
  const threshold = semester.weeklyCapacity * SPIKE_SHARE;

  return semester.courses.map((course) => {
    const courseTasks = semester.tasks.filter((task) => task.courseId === course.id);
    const spikes = weeklyLoad(courseTasks)
      .filter((load) => load.hours > threshold)
      .map(({ week, hours }) => ({ week, hours }));
    const peak = spikes.reduce<CourseSpike | null>(
      (highest, spike) =>
        highest === null || spike.hours > highest.hours ? spike : highest,
      null
    );

    return {
      course,
      peakWeek: peak?.week ?? null,
      peakHours: peak?.hours ?? 0,
      spikes,
    };
  });
}

/** The nearest course spikes in the notice window, with no more than three. */
export function upcomingSpikes(
  summaries: CourseSpikeSummary[],
  currentWeek: number
): UpcomingSpike[] {
  const lastWeek = currentWeek + LOOKAHEAD_WEEKS;

  return summaries
    .flatMap((summary) =>
      summary.spikes.map((spike) => ({ ...spike, course: summary.course }))
    )
    .filter((spike) => spike.week >= currentWeek && spike.week <= lastWeek)
    .sort(
      (a, b) =>
        a.week - b.week || b.hours - a.hours || a.course.code.localeCompare(b.course.code)
    )
    .slice(0, 3);
}
