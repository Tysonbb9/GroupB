import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CourseSpikeSummary } from '../lib/difficulty';
import { attendanceStatus, AttendanceTone } from '../lib/tasks';
import { Semester } from '../lib/types';
import { hoursLabel, weeklyLoad } from '../lib/workload';
import { theme } from '../theme';

const TONE_COLORS: Record<AttendanceTone, string> = {
  calm: theme.calm,
  moderate: theme.moderate,
  heavy: theme.heavy,
  none: theme.faint,
};

/** Height of the tallest bar in a course's strip. */
const MINI_STRIP_HEIGHT = 28;

function weekList(weeks: number[]): string {
  if (weeks.length === 1) return `${weeks[0]}`;
  if (weeks.length === 2) return `${weeks[0]} and ${weeks[1]}`;
  return `${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
}

type Props = {
  semester: Semester;
  /** From courseSpikes(semester), so the screen works it out once. */
  summaries: CourseSpikeSummary[];
};

/**
 * One card per course: its code and name, how many absences are left, and a
 * small 15-week strip of that course's own load with its heavy weeks in the
 * heavy colour. The strip is the course's shape at a glance; the line under
 * it says the peak in words, so colour is never the only signal.
 */
export function CourseCards({ semester, summaries }: Props) {
  return (
    <View testID="courses" style={styles.list}>
      {summaries.map((summary) => {
        const { course } = summary;
        const { label, tone } = attendanceStatus(course);
        const loads = weeklyLoad(semester.tasks.filter((task) => task.courseId === course.id));
        const tallest = Math.max(1, ...loads.map((load) => load.hours));
        const spikeWeeks = new Set(summary.spikes.map((spike) => spike.week));
        const weeks = summary.spikes.map((spike) => spike.week);

        return (
          <View key={course.id} testID={`course-${course.id}`} style={styles.card}>
            <View
              accessible
              accessibilityLabel={`${course.code} ${course.name}, ${label}`}
              style={styles.top}
            >
              <View style={styles.names}>
                <Text style={styles.code}>{course.code}</Text>
                <Text style={styles.name}>{course.name}</Text>
              </View>
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: TONE_COLORS[tone] }]} />
                <Text style={styles.statusText}>{label}</Text>
              </View>
            </View>

            <View style={styles.strip} importantForAccessibility="no-hide-descendants">
              {loads.map((load) => (
                <View
                  key={load.week}
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, (load.hours / tallest) * MINI_STRIP_HEIGHT),
                      backgroundColor: spikeWeeks.has(load.week) ? theme.heavy : theme.rule,
                    },
                  ]}
                />
              ))}
            </View>

            {summary.peakWeek === null ? (
              <Text style={styles.peak}>No heavy weeks</Text>
            ) : (
              <Text
                style={styles.peak}
                accessibilityLabel={`${course.code} has difficulty spikes in weeks ${weekList(weeks)}, based on estimated hours`}
              >
                Peaks in week {summary.peakWeek} at{' '}
                {hoursLabel(summary.peakHours).replace(' hrs', ' hours').replace(' hr', ' hour')}
                <Text style={styles.weeks}> · weeks {weekList(weeks)}</Text>
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space.sm },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space.sm },
  names: { flex: 1, gap: 1 },
  code: { fontSize: 16, fontWeight: '800', color: theme.ink },
  name: { fontSize: 13, color: theme.muted },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: theme.muted, fontWeight: '600' },
  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: MINI_STRIP_HEIGHT },
  bar: { flex: 1, borderRadius: 2 },
  peak: { fontSize: 13, fontWeight: '700', color: theme.ink },
  weeks: { fontWeight: '400', color: theme.muted },
});
