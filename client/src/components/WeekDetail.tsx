import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Course } from '../lib/types';
import { hoursLabel, WeekAssignment, wholeHours } from '../lib/workload';
import { theme } from '../theme';

type Props = {
  week: number;
  /** Total projected hours in the week, matching the bar. */
  hours: number;
  assignments: WeekAssignment[];
  courses: Course[];
};

/**
 * Which assignments make up one week of the strip. Tapping a bar shows this,
 * so a tall bar can be traced back to the work that built it.
 */
export function WeekDetail({ week, hours, assignments, courses }: Props) {
  const courseCode = (id: string) =>
    courses.find((course) => course.id === id)?.code ?? '';

  return (
    <View testID="week-detail" style={styles.card}>
      <Text style={styles.label}>
        Week {week} · {wholeHours(hours)} hours
      </Text>

      {assignments.length === 0 ? (
        <Text style={styles.empty}>Nothing lands in week {week}.</Text>
      ) : (
        assignments.map(({ task, hours: share }) => (
          <View key={task.id} style={styles.row}>
            <View style={styles.main}>
              <Text style={styles.course}>{courseCode(task.courseId)}</Text>
              <Text style={styles.title}>{task.title}</Text>
            </View>
            <Text style={styles.hours}>{hoursLabel(share)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
  },
  empty: { fontSize: 13, color: theme.muted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.rule,
    gap: theme.space.sm,
  },
  main: { flexShrink: 1 },
  course: { fontSize: 10, letterSpacing: 0.6, color: theme.faint, fontWeight: '700' },
  title: { fontSize: 14, fontWeight: '600', color: theme.ink },
  hours: { fontSize: 12, color: theme.muted },
});
