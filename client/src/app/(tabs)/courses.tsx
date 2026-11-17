import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptySemesterScreen } from '../../components/EmptyState';
import { CalendarLinkCard } from '../../components/CalendarLinkCard';
import { CourseCards } from '../../components/CourseCards';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SpikeNotice } from '../../components/SpikeNotice';
import { capacityByWeek } from '../../lib/capacity';
import { SyllabusReminder } from '../../components/SyllabusReminder';
import { courseSpikes, LOOKAHEAD_WEEKS, upcomingSpikes } from '../../lib/difficulty';
import { useSemester } from '../../state/semester-store';
import { theme } from '../../theme';

/** A section's name with its symbol, and an optional line under it. */
function SectionTitle({
  icon,
  title,
  note,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  note?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Ionicons name={icon} size={16} color={theme.accent} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {note !== undefined && <Text style={styles.sectionNote}>{note}</Text>}
    </View>
  );
}

/**
 * Screen 3: Courses.
 *
 * The courses themselves come first: one card each, with attendance and the
 * shape of that course's semester. Then the heads-up notices for the next few
 * weeks, and the reminder to keep each syllabus current. None of it needs
 * acting on every day, so it lives here instead of crowding Forecast
 * (Option A, #96).
 */
export default function CoursesScreen() {
  const router = useRouter();
  const { semester, fromServer } = useSemester();
  if (semester.courses.length === 0) {
    return <EmptySemesterScreen title="Courses" message="Start with courses, then add their syllabi to build your semester." />;
  }

  const summaries = courseSpikes(semester);
  const notices = upcomingSpikes(summaries, semester.currentWeek);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={`${semester.courses.length} courses · ${semester.label}`}
          title="Courses"
          week={semester.currentWeek}
          right={
            <Pressable
              testID="go-to-syllabus"
              accessibilityRole="button"
              accessibilityLabel="Add a syllabus"
              hitSlop={8}
              onPress={() => router.push('/syllabus')}
              style={styles.add}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addText}>Syllabus</Text>
            </Pressable>
          }
        />

        <SectionTitle icon="school" title="Your courses" note="Bars show each course's hours by week" />
        {process.env.EXPO_PUBLIC_USE_FIXTURE !== '1' && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/add-course')} style={styles.add}>
            <Text style={styles.addText}>Add a course</Text>
          </Pressable>
        )}
        <CourseCards semester={semester} summaries={summaries} />

        {notices.length > 0 && (
          <>
            <SectionTitle
              icon="notifications"
              title="Heads up"
              note={`${notices.length} ${notices.length === 1 ? 'course gets' : 'courses get'} busy in the next ${LOOKAHEAD_WEEKS} weeks`}
            />
            <SpikeNotice notices={notices} capacity={capacityByWeek(semester)} />
          </>
        )}

        {/* US-48: the link is saved on the server, so sample data on the device has none. */}
        {fromServer && <CalendarLinkCard />}

        <SyllabusReminder />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  section: { gap: 2, marginTop: theme.space.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.ink },
  sectionNote: { fontSize: 12, color: theme.muted },
});
