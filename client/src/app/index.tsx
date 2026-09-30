import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ComingUp } from '../components/ComingUp';
import { CourseChips } from '../components/CourseChips';
import { WallCard } from '../components/WallCard';
import { WeekDetail } from '../components/WeekDetail';
import { WeekFigures } from '../components/WeekFigures';
import { WeekStrip } from '../components/WeekStrip';
import { comingUp } from '../lib/tasks';
import {
  assignmentsInWeek,
  crunchPeriodAt,
  hoursInWeek,
  nextWall,
  recommendStart,
  weeklyLoad,
} from '../lib/workload';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/** How many assignments the "Coming up" grid shows. */
const COMING_UP_COUNT = 4;

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
  const [selectedWeek, setSelectedWeek] = useState(semester.currentWeek);

  const loads = weeklyLoad(semester.tasks);
  const wall = nextWall(loads, semester.weeklyCapacity, semester.currentWeek);
  const period = wall && crunchPeriodAt(loads, semester.weeklyCapacity, wall.week);
  const recommendation =
    wall && recommendStart(semester.tasks, wall.week, semester.weeklyCapacity);
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
        <WeekFigures
          hoursThisWeek={hoursInWeek(loads, semester.currentWeek)}
          capacity={semester.weeklyCapacity}
          wallWeek={wall?.week ?? null}
        />
        <WeekStrip
          loads={loads}
          capacity={semester.weeklyCapacity}
          currentWeek={semester.currentWeek}
          selectedWeek={selectedWeek}
          wallWeek={wall?.week ?? null}
          onSelectWeek={setSelectedWeek}
        />
      </View>

      <WallCard
        wall={wall}
        period={period}
        capacity={semester.weeklyCapacity}
        currentWeek={semester.currentWeek}
        recommendation={recommendation}
        onPlan={() => router.push('/week')}
      />

      <WeekDetail
        week={selectedWeek}
        hours={hoursInWeek(loads, selectedWeek)}
        assignments={assignmentsInWeek(semester.tasks, selectedWeek)}
        courses={semester.courses}
      />

      <ComingUp
        tasks={comingUp(semester, COMING_UP_COUNT)}
        courses={semester.courses}
        currentWeek={semester.currentWeek}
      />

      <CourseChips courses={semester.courses} />

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
  button: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
