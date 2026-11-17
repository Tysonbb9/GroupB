import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Reminder } from '../lib/api';
import { theme } from '../theme';

type Props = {
  reminder: Reminder;
  /** Opens This week, where the work is. */
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * AI screen 3 (#156): a reminder, as a card at the top of Forecast. The
 * mockup draws it as a phone notification; the app has no notifications
 * yet, so this first version shows the same content in the app. One course,
 * one action and one number, and "1 of 2 today" so the limit is visible
 * rather than trusted. The server decides when there is one; this only
 * shows it.
 */
export function ReminderCard({ reminder, onOpen, onDismiss }: Props) {
  return (
    <View testID="reminder" style={styles.card}>
      <View style={styles.top}>
        <Ionicons name="notifications-outline" size={16} color={theme.accent} />
        <Text style={styles.heading} numberOfLines={2}>
          {reminder.code} · {reminder.title}
        </Text>
      </View>
      <Text style={styles.text}>{reminder.text}</Text>
      <Text testID="reminder-count" style={styles.count}>
        {reminder.countToday} of {reminder.maxPerDay} today
      </Text>
      <View style={styles.buttons}>
        <Pressable
          testID="reminder-open"
          accessibilityRole="button"
          accessibilityLabel={`Open This week for ${reminder.title}`}
          onPress={onOpen}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Open This week</Text>
        </Pressable>
        <Pressable
          testID="reminder-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss the reminder"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.plain}
        >
          <Text style={styles.plainText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  heading: { flex: 1, color: theme.ink, fontSize: 15, fontWeight: '700' },
  text: { color: theme.ink, fontSize: 14, lineHeight: 20 },
  count: { color: theme.muted, fontSize: 12 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md, marginTop: theme.space.xs },
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: theme.space.md, paddingVertical: 8 },
  buttonText: { color: theme.surface, fontSize: 14, fontWeight: '700' },
  plain: { paddingVertical: 8 },
  plainText: { color: theme.accent, fontSize: 14, fontWeight: '700' },
});
