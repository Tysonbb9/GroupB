import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarChange, settleCalendarChanges } from '../lib/api';
import { Task } from '../lib/types';
import { theme } from '../theme';
import { DraftNotice } from './DraftCard';

type Props = {
  changes: CalendarChange[];
  /** Called with what the server changed, so the semester can follow. */
  onSettled: (result: { tasks: Task[]; removedTaskIds: string[] }) => void;
};

/** What a change says, in plain words. */
function describe(change: CalendarChange): string {
  return change.kind === 'moved'
    ? `${change.title} moved from week ${change.fromWeek} to week ${change.toWeek}.`
    : `${change.title} (week ${change.week}) is no longer in your Moodle calendar.`;
}

/**
 * US-50 (#166): deadlines that changed in Moodle since they were added. Each
 * one waits for the student: Accept moves the task to the new week, or
 * deletes it when Moodle removed it; Keep mine leaves the task as it is and
 * stops showing that change. Nothing changes in the forecast until then.
 */
export function CalendarChanges({ changes, onSettled }: Props) {
  const [shown, setShown] = useState(changes);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (shown.length === 0) return null;

  const settle = async (accept: string[], keep: string[]) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await settleCalendarChanges({ accept, keep });
      onSettled(result);
      const settled = new Set([...accept, ...keep]);
      setShown((current) => current.filter((c) => !settled.has(c.eventId)));
    } catch (error) {
      setProblem(`Could not save, so nothing has changed. ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="calendar-changes" style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Changes in Moodle
      </Text>
      {shown.map((change) => (
        <View key={change.eventId} testID={`calendar-change-${change.eventId}`} style={styles.row}>
          <Text style={styles.text}>{describe(change)}</Text>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                change.kind === 'moved' ? `Move ${change.title} to week ${change.toWeek}` : `Remove ${change.title}`
              }
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => settle([change.eventId], [])}
              style={[styles.button, busy && styles.off]}
            >
              <Text style={styles.buttonText}>{change.kind === 'moved' ? `Move to week ${change.toWeek}` : 'Remove it'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Keep ${change.title} as it is`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => settle([], [change.eventId])}
              style={styles.plain}
            >
              <Text style={styles.plainText}>Keep mine</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {shown.length > 1 && (
        <Pressable
          testID="calendar-accept-all"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => settle(shown.map((c) => c.eventId), [])}
          style={styles.plain}
        >
          <Text style={styles.plainText}>Accept all {shown.length}</Text>
        </Pressable>
      )}
      {problem !== null && (
        <DraftNotice testID="calendar-changes-problem" error>
          {problem}
        </DraftNotice>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: 14,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  title: { fontSize: 15, fontWeight: '800', color: theme.ink },
  row: { gap: theme.space.xs, paddingVertical: theme.space.xs, borderBottomWidth: 1, borderBottomColor: theme.rule },
  text: { fontSize: 14, color: theme.ink },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: theme.space.md, paddingVertical: 8 },
  off: { opacity: 0.6 },
  buttonText: { color: theme.surface, fontSize: 13, fontWeight: '700' },
  plain: { paddingVertical: 8 },
  plainText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
});
