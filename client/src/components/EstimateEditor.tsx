import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_ESTIMATE_HOURS, parseEstimate } from '../lib/estimate';
import { theme } from '../theme';

type Props = {
  taskId: string;
  title: string;
  onSave: (hours: number) => void;
};

/**
 * Lets the student say how long a task with no estimate will take. Until they
 * do, the task stays in the list but puts nothing in the forecast.
 */
export function EstimateEditor({ taskId, title, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const save = () => {
    const parsed = parseEstimate(text);
    // Blank means "still unknown", which is what the task already is.
    if (parsed.ok && parsed.hours === null) {
      setEditing(false);
      return;
    }
    if (!parsed.ok || parsed.hours === null) {
      setInvalid(true);
      return;
    }
    onSave(parsed.hours);
    setEditing(false);
  };

  if (!editing) {
    return (
      <Pressable
        testID={`estimate-open-${taskId}`}
        accessibilityRole="button"
        accessibilityLabel={`Add estimate for ${title}`}
        onPress={() => setEditing(true)}
      >
        <Text style={styles.link}>Add estimate</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor}>
      <View style={styles.inputRow}>
        <TextInput
          testID={`estimate-input-${taskId}`}
          accessibilityLabel={`Estimated hours for ${title}`}
          style={[styles.input, invalid && styles.inputInvalid]}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setInvalid(false);
          }}
          keyboardType="decimal-pad"
          placeholder="hours"
          placeholderTextColor={theme.faint}
        />
        <Pressable
          testID={`estimate-save-${taskId}`}
          accessibilityRole="button"
          accessibilityLabel={`Save estimate for ${title}`}
          onPress={save}
        >
          <Text style={styles.link}>Save</Text>
        </Pressable>
        <Pressable
          testID={`estimate-cancel-${taskId}`}
          accessibilityRole="button"
          accessibilityLabel={`Cancel estimate for ${title}`}
          onPress={() => setEditing(false)}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      {invalid && (
        <Text testID={`estimate-error-${taskId}`} style={styles.error}>
          Enter hours between 0 and {MAX_ESTIMATE_HOURS}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 11, fontWeight: '700', color: theme.accent },
  cancel: { fontSize: 11, color: theme.muted },
  editor: { gap: theme.space.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  input: {
    minWidth: 64,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: 4,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    fontSize: 13,
    color: theme.ink,
    backgroundColor: theme.bg,
  },
  inputInvalid: { borderColor: theme.heavy },
  error: { fontSize: 11, color: theme.heavy },
});
