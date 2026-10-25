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
 * one is always shown when the Semester screen opens, and the student can
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
      <Text style={styles.label}>Reminder</Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    padding: theme.space.md,
    gap: theme.space.xs,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
  },
  title: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  body: { color: theme.muted, fontSize: 12, lineHeight: 17 },
  dismiss: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: theme.space.xs,
  },
  dismissText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
});
