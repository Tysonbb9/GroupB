import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { rankThisWeek } from '../lib/tasks';
import { startBy, weeklyLoad } from '../lib/workload';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/**
 * Screen 2 — This week.
 *
 * What is in front of you, most urgent first, and the completion tap.
 * Marking something done takes its hours out of the forecast, so the wall
 * on screen 1 gets shorter. That is the reward: not a streak, the actual
 * work getting smaller.
 */
export default function WeekScreen() {
  const { semester, toggleDone } = useSemester();

  const ranked = rankThisWeek(semester);
  const loads = weeklyLoad(semester.tasks);
  const thisWeekHours = loads.find((l) => l.week === semester.currentWeek)?.hours ?? 0;
  const courseCode = (id: string) =>
    semester.courses.find((c) => c.id === id)?.code ?? '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.title}>Week {semester.currentWeek}</Text>
        <Text testID="week-hours" style={styles.subtitle}>
          {Math.round(thisWeekHours)} hours of work land this week · {semester.weeklyCapacity} available
        </Text>
      </View>

      {ranked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing left. Genuinely nothing.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {ranked.map((task) => {
            const overdue = task.dueWeek < semester.currentWeek;
            const start = startBy(task, semester.weeklyCapacity);
            const startsSoon = start !== null && start <= semester.currentWeek;

            return (
              <View key={task.id} style={styles.item}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemCourse}>{courseCode(task.courseId)}</Text>
                  <Text style={styles.itemTitle}>{task.title}</Text>
                  <Text style={[styles.itemMeta, overdue && styles.overdue]}>
                    {overdue ? `Overdue — was week ${task.dueWeek}` : `Due week ${task.dueWeek}`}
                    {task.estimatedHours !== null && ` · ~${task.estimatedHours} hrs`}
                    {!overdue && startsSoon && ' · start now'}
                  </Text>
                </View>

                <Pressable
                  testID={`done-${task.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Mark ${task.title} done`}
                  style={styles.done}
                  onPress={() => toggleDone(task.id)}
                >
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  title: { fontSize: 26, fontWeight: '700', color: theme.ink },
  subtitle: { fontSize: 13, color: theme.muted, marginTop: 2 },
  list: { gap: theme.space.sm },
  item: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  itemMain: { flex: 1, gap: 1 },
  itemCourse: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.faint,
    fontWeight: '700',
  },
  itemTitle: { fontSize: 15, fontWeight: '600', color: theme.ink },
  itemMeta: { fontSize: 12, color: theme.muted },
  overdue: { color: theme.heavy, fontWeight: '600' },
  done: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  doneText: { color: theme.accent, fontWeight: '700', fontSize: 13 },
  empty: {
    backgroundColor: theme.accentSoft,
    borderRadius: theme.radius,
    padding: theme.space.lg,
    alignItems: 'center',
  },
  emptyText: { color: theme.accent, fontWeight: '600' },
});
