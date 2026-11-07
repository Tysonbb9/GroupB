import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CourseChips } from '../../components/CourseChips';
import { DifficultySummary } from '../../components/DifficultySummary';
import { SpikeNotice } from '../../components/SpikeNotice';
import { SyllabusReminder } from '../../components/SyllabusReminder';
import { courseSpikes, upcomingSpikes } from '../../lib/difficulty';
import { useSemester } from '../../state/semester-store';
import { theme } from '../../theme';

/**
 * Screen 3: Courses.
 *
 * Everything about the courses themselves, one tap from Forecast: the
 * heads-up notices, which courses spike and when, attendance, and keeping
 * each syllabus current. None of it needs acting on every day, so it lives
 * here instead of crowding the first screen (Option A, #96).
 */
export default function CoursesScreen() {
  const router = useRouter();
  const { semester } = useSemester();
  const spikeSummaries = courseSpikes(semester);
  const notices = upcomingSpikes(spikeSummaries, semester.currentWeek);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SpikeNotice notices={notices} capacity={semester.weeklyCapacity} />

      <DifficultySummary summaries={spikeSummaries} />

      <CourseChips courses={semester.courses} />

      <SyllabusReminder />

      <Pressable
        testID="go-to-syllabus"
        accessibilityRole="button"
        onPress={() => router.push('/syllabus')}
        style={styles.addSyllabus}
      >
        <Ionicons name="document-text-outline" size={18} color={theme.accent} />
        <Text style={styles.addSyllabusText}>Add a syllabus</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  addSyllabus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    backgroundColor: theme.surface,
    borderColor: theme.rule,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingVertical: 12,
  },
  addSyllabusText: { color: theme.accent, fontWeight: '700', fontSize: 14 },
});
