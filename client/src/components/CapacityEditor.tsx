import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_WEEKLY_HOURS, MIN_WEEKLY_HOURS, parseWeeklyHours } from '../lib/capacity';
import { theme } from '../theme';

type Props = {
  capacity: number;
  /** Keeps the new hours. Rejects when they could not be kept. */
  onSave: (hours: number) => Promise<void>;
};

/**
 * The line under the week strip that says what the dashed line is, with a
 * way to change it (US-32): "Dashed line is your 15 hours a week. Change".
 *
 * Change opens a box with the current hours in it. Nothing on screen moves
 * while the student types; Save keeps the new hours and the whole forecast
 * is redrawn with them. If they cannot be kept, the box stays open and says
 * the hours have not changed.
 */
export function CapacityEditor({ capacity, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = () => {
    setText(String(capacity));
    setProblem(null);
    setEditing(true);
  };

  const save = async () => {
    const hours = parseWeeklyHours(text);
    if (hours === null) {
      setProblem(`Enter whole hours from ${MIN_WEEKLY_HOURS} to ${MAX_WEEKLY_HOURS}.`);
      return;
    }
    // The same hours again: nothing to keep.
    if (hours === capacity) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(hours);
      setEditing(false);
    } catch {
      setProblem(`Could not save. Your hours are still ${capacity}.`);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <View style={styles.line}>
        {/* Read out again when it changes, so a screen reader hears the new hours. */}
        <Text style={styles.note} accessibilityLiveRegion="polite">
          Dashed line is your {capacity} hours a week
        </Text>
        <Pressable
          testID="capacity-change"
          accessibilityRole="button"
          accessibilityLabel={`Change your hours a week, now ${capacity}`}
          hitSlop={10}
          onPress={open}
        >
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="capacity-editor" style={styles.editor}>
      <Text style={styles.label}>Hours you have each week</Text>
      <View style={styles.row}>
        <TextInput
          testID="capacity-input"
          accessibilityLabel="Hours you have each week"
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
          testID="capacity-save"
          accessibilityRole="button"
          accessibilityState={{ busy: saving }}
          disabled={saving}
          onPress={save}
          style={styles.save}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable
          testID="capacity-cancel"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setEditing(false)}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      {problem !== null ? (
        <Text testID="capacity-problem" style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      ) : (
        <Text style={styles.help}>
          Whole hours, {MIN_WEEKLY_HOURS} to {MAX_WEEKLY_HOURS}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    marginTop: theme.space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  note: { fontSize: 11, color: theme.muted },
  link: { fontSize: 11, fontWeight: '700', color: theme.accent },
  editor: {
    marginTop: theme.space.sm,
    paddingTop: theme.space.sm,
    borderTopWidth: 1,
    borderTopColor: theme.rule,
    gap: theme.space.xs,
  },
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
