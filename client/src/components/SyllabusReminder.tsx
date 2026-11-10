import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const TITLE = 'Keep your syllabi up to date';
const BODY = 'If a class changed its schedule, update its syllabus so your forecast stays accurate.';

/**
 * US-26: a reminder to review and update syllabus information, so the forecast
 * does not go stale.
 *
 * The SRS has not decided when or how often reminders appear (OI-09), so this
 * one is always shown when the Courses screen opens, and the student can
 * dismiss it until the app is opened again. Nothing is stored.
 */
export function SyllabusReminder() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <View
      testID="syllabus-reminder"
      accessibilityLabel={`Reminder: keep your syllabi up to date. ${BODY}`}
      style={styles.card}
    >
      <View style={styles.bubble}>
        <Ionicons name="refresh" size={18} color={theme.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={styles.body}>{BODY}</Text>
        <Pressable
          testID="syllabus-reminder-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss the syllabus reminder"
          onPress={() => setDismissed(true)}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentSoft,
  },
  text: { flex: 1, gap: theme.space.xs },
  title: { color: theme.ink, fontSize: 14, fontWeight: '700' },
  body: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  dismiss: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  dismissText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
});
