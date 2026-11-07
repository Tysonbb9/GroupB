import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SummaryRow } from '../../components/SummaryRow';
import { WallCard } from '../../components/WallCard';
import { WeekDetail } from '../../components/WeekDetail';
import { WeekFigures } from '../../components/WeekFigures';
import { WeekStrip } from '../../components/WeekStrip';
import { courseSpikes, LOOKAHEAD_WEEKS, upcomingSpikes } from '../../lib/difficulty';
import {
  assignmentsInWeek,
  crunchPeriodAt,
  hoursInWeek,
  nextWall,
  recommendStart,
  weeklyLoad,
} from '../../lib/workload';
import { useSemester } from '../../state/semester-store';
import { theme } from '../../theme';

/**
 * Screen 1: Forecast.
 *
 * One focus (Option A, #96): this week's hours, the fifteen weeks with the
 * ones that do not fit marked, and the one thing to act on. The notices and
 * the course summary are one tap away on the Courses tab, and a week's
 * assignments open when its bar is tapped.
 */
export default function SemesterScreen() {
  const router = useRouter();
  const { semester } = useSemester();
  // No week is open until a bar is tapped, so the screen starts uncluttered.
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  const loads = weeklyLoad(semester.tasks);
  const wall = nextWall(loads, semester.weeklyCapacity, semester.currentWeek);
  const period = wall && crunchPeriodAt(loads, semester.weeklyCapacity, wall.week);
  const recommendation =
    wall && recommendStart(semester.tasks, wall.week, semester.weeklyCapacity);
  const spikeSummaries = courseSpikes(semester);
  const notices = upcomingSpikes(spikeSummaries, semester.currentWeek);
  const spikingCourses = spikeSummaries.filter((s) => s.spikes.length > 0).length;

  // Tapping the open week's bar again closes it.
  const toggleWeek = (week: number) => setOpenWeek((open) => (open === week ? null : week));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <Text style={styles.subtitle}>
          <Text>{semester.label}</Text> · Week {semester.currentWeek} of 15
        </Text>
        <Pressable
          testID="go-to-login"
          accessibilityRole="button"
          accessibilityLabel="Log in"
          hitSlop={10}
          onPress={() => router.push('/login')}
        >
          <Ionicons name="person-circle-outline" size={28} color={theme.accent} />
        </Pressable>
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
          selectedWeek={openWeek ?? semester.currentWeek}
          wallWeek={wall?.week ?? null}
          onSelectWeek={toggleWeek}
        />
      </View>

      {openWeek !== null && (
        <WeekDetail
          week={openWeek}
          hours={hoursInWeek(loads, openWeek)}
          assignments={assignmentsInWeek(semester.tasks, openWeek)}
          courses={semester.courses}
        />
      )}

      <WallCard
        wall={wall}
        period={period}
        capacity={semester.weeklyCapacity}
        currentWeek={semester.currentWeek}
        recommendation={recommendation}
        onPlan={() => router.push('/week')}
      />

      <View style={styles.rows}>
        <SummaryRow
          testID="heads-up-row"
          title="Heads up"
          detail={
            notices.length === 0
              ? `Nothing in the next ${LOOKAHEAD_WEEKS} weeks`
              : `${notices.length} ${notices.length === 1 ? 'notice' : 'notices'} in the next ${LOOKAHEAD_WEEKS} weeks`
          }
          onPress={() => router.push('/courses')}
        />
        <View style={styles.divider} />
        <SummaryRow
          testID="course-spikes-row"
          title="Course spikes"
          detail={`${spikingCourses} of ${semester.courses.length} courses have heavy weeks`}
          onPress={() => router.push('/courses')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, paddingTop: 0, gap: theme.space.md, paddingBottom: theme.space.xl },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtitle: { fontSize: 14, color: theme.muted },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  rows: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
  },
  divider: { height: 1, backgroundColor: theme.rule, marginLeft: theme.space.md },
});
