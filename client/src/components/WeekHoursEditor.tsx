import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_WEEKLY_HOURS, MIN_WEEKLY_HOURS, parseWeeklyHours } from '../lib/capacity';
import { theme } from '../theme';

type Props = {
  week: number;
  /** The student's weekly number, which a week without its own hours uses. */
  weeklyCapacity: number;
  /** This week's own hours, or null when it uses the weekly number. */
  ownHours: number | null;
  /** Keeps the week's hours, or clears them with null. Rejects when they could not be kept. */
  onSave: (hours: number | null) => Promise<void>;
};

/**
 * #148: one week's hours, under that week's assignments. Some weeks differ
 * (10 hours this week, 20 next), so a week can be given its own hours, which
 * replace the weekly number there and nowhere else. "Use my weekly hours"
 * clears them again. Like the weekly editor (US-32), nothing changes until
 * the hours are saved, and a failed save leaves them as they were.
 */
export function WeekHoursEditor({ week, weeklyCapacity, ownHours, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hours = ownHours ?? weeklyCapacity;

  const keep = async (value: number | null) => {
    setSaving(true);
    setProblem(null);
    try {
      await onSave(value);
      setEditing(false);
    } catch {
      setProblem(`Could not save. Week ${week} still has ${hours} hours.`);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const parsed = parseWeeklyHours(text);
    if (parsed === null) {
      setProblem(`Enter whole hours from ${MIN_WEEKLY_HOURS} to ${MAX_WEEKLY_HOURS}.`);
      return;
    }
    // The weekly number typed in: the week no longer needs its own hours.
    const wanted = parsed === weeklyCapacity ? null : parsed;
    // Nothing would change, so there is nothing to keep.
    if (wanted === ownHours) {
      setEditing(false);
      return;
    }
    void keep(wanted);
  };

  if (!editing) {
    return (
      <View testID="own-week-hours" style={styles.line}>
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {ownHours === null
            ? `You set aside ${hours} hours in week ${week}, your weekly number`
            : `You set aside ${hours} hours in week ${week}, set for this week only`}
        </Text>
        <Pressable
          testID="own-week-hours-change"
          accessibilityRole="button"
          accessibilityLabel={`Change the hours you set aside in week ${week}, now ${hours}`}
          hitSlop={10}
          onPress={() => {
            setText(String(hours));
            setProblem(null);
            setEditing(true);
          }}
        >
          <Text style={styles.link}>Change</Text>
        </Pressable>
        {ownHours !== null && (
          <Pressable
            testID="own-week-hours-clear"
            accessibilityRole="button"
            accessibilityLabel={`Use your weekly ${weeklyCapacity} hours in week ${week}`}
            accessibilityState={{ busy: saving }}
            disabled={saving}
            hitSlop={10}
            onPress={() => void keep(null)}
          >
            <Text style={styles.link}>Use my weekly hours</Text>
          </Pressable>
        )}
        {problem !== null && (
          <Text testID="own-week-hours-problem" style={styles.problem} accessibilityLiveRegion="polite">
            {problem}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View testID="own-week-hours-editor" style={styles.editor}>
      <Text style={styles.label}>Hours you set aside in week {week}</Text>
      <View style={styles.row}>
        <TextInput
          testID="own-week-hours-input"
          accessibilityLabel={`Hours you set aside in week ${week}`}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setProblem(null);
          }}
          onSubmitEditing={save}
          keyboardType="number-pad"
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          style={[styles.input, problem !== null && styles.inputProblem]}
        />
        <Pressable
          testID="own-week-hours-save"
          accessibilityRole="button"
          accessibilityState={{ busy: saving }}
          disabled={saving}
          onPress={save}
          style={styles.save}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable
          testID="own-week-hours-cancel"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setEditing(false)}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      {problem !== null ? (
        <Text testID="own-week-hours-problem" style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : (
        <Text style={styles.help}>
          Whole hours, {MIN_WEEKLY_HOURS} to {MAX_WEEKLY_HOURS}. Only week {week} changes; your weekly number stays {weeklyCapacity}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingTop: theme.space.xs,
  },
  note: { fontSize: 12, color: theme.muted },
  link: { fontSize: 12, fontWeight: '700', color: theme.accent },
  editor: { gap: theme.space.xs, paddingTop: theme.space.xs },
  label: { fontSize: 13, fontWeight: '700', color: theme.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  input: {
    width: 72,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.bg,
  },
  inputProblem: { borderColor: theme.heavy },
  save: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs + 2,
  },
  saveText: { fontSize: 13, fontWeight: '700', color: theme.surface },
  cancel: { fontSize: 13, color: theme.muted },
  help: { fontSize: 11, color: theme.muted },
  problem: { fontSize: 11, fontWeight: '600', color: theme.heavy },
});
