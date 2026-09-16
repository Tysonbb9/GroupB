import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WeekStrip } from '../components/WeekStrip';
import { absencesRemaining } from '../lib/tasks';
import { detectCrunch, weeklyLoad } from '../lib/workload';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/**
 * Screen 1 — Semester.
 *
 * Everything still outstanding, laid out across the fifteen weeks, with the
 * weeks that do not fit marked. This works in week one from the syllabus
 * alone: no scores, no history, nothing the student has to keep feeding it.
 */
export default function SemesterScreen() {
  const router = useRouter();
  const { semester } = useSemester();

  const loads = weeklyLoad(semester.tasks);
  const crunches = detectCrunch(loads, semester.weeklyCapacity);
  const nextCrunch = crunches.find((c) => c.endWeek >= semester.currentWeek);
  const outstanding = semester.tasks.filter((t) => !t.done).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.title}>{semester.label}</Text>
        <Text style={styles.subtitle}>
          Week {semester.currentWeek} of 15 · {semester.courses.length} courses ·{' '}
          {outstanding} things left
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Projected hours per week</Text>
        <WeekStrip
          loads={loads}
          capacity={semester.weeklyCapacity}
          currentWeek={semester.currentWeek}
        />
      </View>

      <View
        testID="crunch-summary"
        style={[styles.callout, !nextCrunch && styles.calloutClear]}
      >
        {nextCrunch ? (
          <Text style={styles.calloutText}>
            <Text style={styles.calloutStrong}>
              Week {nextCrunch.startWeek} is your next wall.
            </Text>{' '}
            {Math.round(nextCrunch.peakHours)} hours projected against{' '}
            {semester.weeklyCapacity} available.
          </Text>
        ) : (
          <Text style={styles.calloutText}>
            <Text style={styles.calloutStrong}>Nothing over capacity ahead.</Text>{' '}
            Every remaining week fits in {semester.weeklyCapacity} hours.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Courses</Text>
        {semester.courses.map((course) => {
          const left = absencesRemaining(course);
          return (
            <View key={course.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowCode}>{course.code}</Text>
                <Text style={styles.rowName}>{course.name}</Text>
              </View>
              <Text style={styles.rowMeta}>
                {left === null
                  ? 'no attendance policy'
                  : `${left} absence${left === 1 ? '' : 's'} left`}
              </Text>
            </View>
          );
        })}
      </View>

      <Pressable
        testID="go-to-week"
        style={styles.button}
        onPress={() => router.push('/week')}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>See this week</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  title: { fontSize: 28, fontWeight: '700', color: theme.ink },
  subtitle: { fontSize: 13, color: theme.muted, marginTop: 2 },
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
  callout: {
    backgroundColor: '#F6E7E4',
    borderLeftWidth: 3,
    borderLeftColor: theme.heavy,
    borderRadius: 4,
    padding: theme.space.md,
  },
  calloutClear: { backgroundColor: theme.accentSoft, borderLeftColor: theme.calm },
  calloutText: { fontSize: 14, color: theme.ink, lineHeight: 20 },
  calloutStrong: { fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.rule,
    gap: theme.space.sm,
  },
  rowMain: { flexShrink: 1 },
  rowCode: { fontSize: 13, fontWeight: '700', color: theme.ink },
  rowName: { fontSize: 12, color: theme.muted },
  rowMeta: { fontSize: 11, color: theme.faint, textAlign: 'right' },
  button: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
