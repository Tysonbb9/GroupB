import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompletedTasks } from '../../components/CompletedTasks';
import { Figure } from '../../components/Figure';
import { LoadPill } from '../../components/LoadPill';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionHeader } from '../../components/SectionHeader';
import { SummaryRow } from '../../components/SummaryRow';
import { TaskRow } from '../../components/TaskRow';
import { groupThisWeek, startsNow } from '../../lib/tasks';
import { hoursInWeek, weeklyLoad, wholeHours } from '../../lib/workload';
import { useSemester } from '../../state/semester-store';
import { theme } from '../../theme';

/**
 * Screen 2: This week.
 *
 * What is in front of you, most urgent first, and the completion tap.
 * Marking something done takes its hours out of the forecast, so the wall
 * on screen 1 gets shorter. That is the reward: not a streak, the actual
 * work getting smaller.
 */
export default function WeekScreen() {
  const router = useRouter();
  const { semester, toggleDone, setEstimate } = useSemester();

  const groups = groupThisWeek(semester);
  const itemsLeft = groups.reduce((count, group) => count + group.tasks.length, 0);
  const thisWeekHours = hoursInWeek(weeklyLoad(semester.tasks), semester.currentWeek);
  // Work due after next week is not on this list; Forecast shows it week by week.
  const later = semester.tasks.filter(
    (t) => !t.done && t.dueWeek > semester.currentWeek + 1
  ).length;
  const courseCode = (id: string) =>
    semester.courses.find((c) => c.id === id)?.code ?? '';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={`Week ${semester.currentWeek} of 15`}
          title="This week"
          right={<LoadPill hours={thisWeekHours} capacity={semester.weeklyCapacity} />}
        />

        <View style={styles.figures}>
          <Figure
            testID="week-hours"
            label="Landing this week"
            value={String(wholeHours(thisWeekHours))}
            unit={`/ ${semester.weeklyCapacity} hrs`}
            accessibilityLabel={`${wholeHours(thisWeekHours)} of ${semester.weeklyCapacity} hours land this week`}
          />
          <Figure
            testID="items-left"
            label="Left to do"
            value={String(itemsLeft)}
            unit={itemsLeft === 1 ? 'item' : 'items'}
            align="right"
            accessibilityLabel={`${itemsLeft} items left to do`}
          />
        </View>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing left. Genuinely nothing.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <SectionHeader label={group.label} warn={group.key === 'overdue'} />
              {group.tasks.map((task) => {
                const overdue = task.dueWeek < semester.currentWeek;

                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    courseCode={courseCode(task.courseId)}
                    overdueSince={overdue ? task.dueWeek : null}
                    startNow={startsNow(task, semester.currentWeek, semester.weeklyCapacity)}
                    onDone={() => toggleDone(task.id)}
                    onEstimate={(hours) => setEstimate(task.id, hours)}
                  />
                );
              })}
            </View>
          ))
        )}

        <CompletedTasks
          tasks={semester.tasks.filter((t) => t.done)}
          courseCode={courseCode}
          onUndo={toggleDone}
        />

        {later > 0 && (
          <View style={styles.laterCard}>
            <SummaryRow
              testID="later-row"
              icon="calendar"
              tint={theme.accent}
              title="Later this semester"
              detail={`${later} ${later === 1 ? 'assignment' : 'assignments'} after next week, on Forecast`}
              onPress={() => router.push('/')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
  },
  group: { gap: theme.space.sm },
  empty: {
    backgroundColor: theme.accentSoft,
    borderRadius: 14,
    padding: theme.space.lg,
    alignItems: 'center',
  },
  emptyText: { color: theme.accent, fontWeight: '600' },
  laterCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
  },
});
