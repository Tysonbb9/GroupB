import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckinCard } from '../../components/CheckinCard';
import { ReminderCard } from '../../components/ReminderCard';
import { EmptySemesterScreen } from '../../components/EmptyState';
import { LoadPill } from '../../components/LoadPill';
import { LogOutButton } from '../../components/LogOutButton';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SummaryRow } from '../../components/SummaryRow';
import { WallCard } from '../../components/WallCard';
import { WeekDetail } from '../../components/WeekDetail';
import { WeekFigures } from '../../components/WeekFigures';
import { WeekStrip } from '../../components/WeekStrip';
import { CheckinQuestion, fetchCheckinQuestion, fetchReminder, Reminder } from '../../lib/api';
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
 * the courses are one tap away on the Courses tab, and a week's assignments
 * open when its bar is tapped.
 */
export default function SemesterScreen() {
  const router = useRouter();
  const { semester, setWeeklyCapacity, fromServer, replaceTasks } = useSemester();
  // #155: the one check-in question, if the server has one to ask.
  const [question, setQuestion] = useState<CheckinQuestion | null>(null);

  // Ask the server once, and again when the student's courses change (a new
  // account loading the sample semester). With sample data (tests, the fixture
  // switch) there is no server, so no question. A failure only hides the card.
  const courseCount = semester.courses.length;
  useEffect(() => {
    if (!fromServer || courseCount === 0) return;
    let cancelled = false;
    fetchCheckinQuestion()
      .then((q) => {
        if (!cancelled) setQuestion(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fromServer, courseCount]);
  // #156: a reminder, if the server's limits allow one now. Asked for once
  // when Forecast opens, like the check-in question; the server records the
  // one it gives, so asking again would use up the day's limit. A failure
  // only hides the card.
  const [reminder, setReminder] = useState<Reminder | null>(null);
  useEffect(() => {
    if (!fromServer || courseCount === 0) return;
    let cancelled = false;
    fetchReminder()
      .then((r) => {
        if (!cancelled) setReminder(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fromServer, courseCount]);
  // No week is open until a bar is tapped, so the screen starts uncluttered.
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  if (semester.courses.length === 0) {
    return <EmptySemesterScreen title="Forecast" message="Add courses and their syllabi to see your weekly workload." />;
  }

  const loads = weeklyLoad(semester.tasks);
  const thisWeekHours = hoursInWeek(loads, semester.currentWeek);
  const wall = nextWall(loads, semester.weeklyCapacity, semester.currentWeek);
  const period = wall && crunchPeriodAt(loads, semester.weeklyCapacity, wall.week);
  const recommendation =
    wall && recommendStart(semester.tasks, wall.week, semester.weeklyCapacity);
  const spikeSummaries = courseSpikes(semester);
  const notices = upcomingSpikes(spikeSummaries, semester.currentWeek);
  // The course whose single heaviest week is heaviest, for the Course spikes row.
  const heaviest = spikeSummaries
    .filter((s) => s.peakWeek !== null)
    .reduce<(typeof spikeSummaries)[number] | null>(
      (top, s) => (top === null || s.peakHours > top.peakHours ? s : top),
      null
    );

  // Tapping the open week's bar again closes it.
  const toggleWeek = (week: number) => setOpenWeek((open) => (open === week ? null : week));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={semester.label}
          title="Forecast"
          week={semester.currentWeek}
          right={
            <>
              <LoadPill hours={thisWeekHours} capacity={semester.weeklyCapacity} />
              <LogOutButton />
            </>
          }
        />

        {reminder !== null && (
          <ReminderCard
            reminder={reminder}
            onOpen={() => {
              setReminder(null);
              router.push('/week');
            }}
            onDismiss={() => setReminder(null)}
          />
        )}

        {question !== null && (
          <CheckinCard
            question={question}
            tasks={semester.tasks.filter(
              (t) => t.courseId === question.courseId && !t.done && t.dueWeek >= semester.currentWeek
            )}
            onSaved={replaceTasks}
            onClose={() => setQuestion(null)}
          />
        )}

        <View style={styles.card}>
          <WeekFigures
            hoursThisWeek={thisWeekHours}
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
            onSaveCapacity={setWeeklyCapacity}
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
            icon="notifications"
            tint={theme.moderate}
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
            icon="pulse"
            tint={theme.heavy}
            title="Course spikes"
            detail={
              heaviest === null
                ? 'No course has a heavy week'
                : `Heaviest: ${heaviest.course.code} in week ${heaviest.peakWeek}`
            }
            onPress={() => router.push('/courses')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  rows: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
  },
  divider: { height: 1, backgroundColor: theme.rule, marginLeft: 68 },
});
