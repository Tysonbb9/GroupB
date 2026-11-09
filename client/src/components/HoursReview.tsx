import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addReview } from '../lib/api';
import { parseEstimate } from '../lib/estimate';
import { Task } from '../lib/types';
import { theme } from '../theme';

type Props = {
  /** The task the student just ticked done. */
  task: Task;
  /** Hides the card (Skip, or Close after saving). */
  onClose: () => void;
};

/**
 * US-23: the moment a task is ticked done, a card asks how long it really
 * took. Save sends it to POST /courses/:id/reviews, which stores it (in
 * Supabase when the server has its keys), so the crowd's data is kept.
 * Skip hides the card without saving anything.
 */
export function HoursReview({ task, onClose }: Props) {
  const [hours, setHours] = useState('');
  /** What went wrong, in words the student can act on. */
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = parseEstimate(hours);
    if (!parsed.ok || parsed.hours === null) {
      setMessage('Enter the hours it took, more than 0 and up to 100.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await addReview(task.courseId, { title: task.title, hours: parsed.hours });
      setSaved(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="hours-review" style={styles.card}>
      <Text style={styles.done}>{`${task.title} is done.`}</Text>

      {saved ? (
        <Text testID="hours-review-saved" style={styles.thanks}>
          Thanks, your hours were saved. They help estimate this assignment for other students.
        </Text>
      ) : (
        <>
          <Text style={styles.question}>How long did it take you?</Text>
          <View style={styles.row}>
            <TextInput
              testID="hours-review-input"
              accessibilityLabel={`Hours ${task.title} took`}
              value={hours}
              onChangeText={setHours}
              placeholder="e.g. 3"
              placeholderTextColor={theme.faint}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Text style={styles.unit}>hours</Text>
            <Pressable
              testID="hours-review-save"
              accessibilityRole="button"
              accessibilityLabel={`Save hours for ${task.title}`}
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={save}
              style={[styles.button, saving && styles.buttonOff]}
            >
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
          </View>
          {message !== null && <Text style={styles.error}>{message}</Text>}
        </>
      )}

      <Pressable testID="hours-review-close" accessibilityRole="button" onPress={onClose} hitSlop={8}>
        <Text style={styles.link}>{saved ? 'Close' : 'Skip'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.accentSoft,
    borderRadius: 14,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  done: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  question: { color: theme.ink, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  input: {
    width: 90,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: 999,
    color: theme.ink,
    fontSize: 16,
    paddingHorizontal: theme.space.md,
    paddingVertical: 10,
    textAlign: 'center',
  },
  unit: { color: theme.muted, fontSize: 14 },
  button: {
    marginLeft: 'auto',
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 10,
  },
  buttonOff: { opacity: 0.6 },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
  thanks: { color: theme.ink, fontSize: 14, lineHeight: 20 },
  error: { color: theme.heavy, fontSize: 13 },
  link: { color: theme.accent, fontSize: 13, fontWeight: '700' },
});
