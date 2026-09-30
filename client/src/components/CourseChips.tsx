import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { attendanceStatus, AttendanceTone } from '../lib/tasks';
import { Course } from '../lib/types';
import { theme } from '../theme';

const TONE_COLORS: Record<AttendanceTone, string> = {
  calm: theme.calm,
  moderate: theme.moderate,
  heavy: theme.heavy,
  none: theme.faint,
};

/**
 * One chip per course in a row that scrolls sideways: the course code, and
 * how many absences are left. Reference material that takes one row rather
 * than five.
 */
export function CourseChips({ courses }: { courses: Course[] }) {
  return (
    <View testID="courses">
      <Text style={styles.label}>Courses</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {courses.map((course) => {
          const { label, tone } = attendanceStatus(course);
          return (
            <View
              key={course.id}
              accessible
              accessibilityLabel={`${course.code} ${course.name}, ${label}`}
              style={styles.chip}
            >
              <Text style={styles.code}>{course.code}</Text>
              <View style={styles.status}>
                <View style={[styles.dot, { backgroundColor: TONE_COLORS[tone] }]} />
                <Text style={styles.statusText}>{label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
    marginBottom: theme.space.sm,
  },
  row: { gap: theme.space.sm },
  chip: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    minWidth: 96,
    gap: 3,
  },
  code: { fontSize: 13, fontWeight: '800', color: theme.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: theme.muted },
});
