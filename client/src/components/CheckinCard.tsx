import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { answerCheckin, CheckinAnswer, CheckinChange, CheckinQuestion } from '../lib/api';
import { checkDraft, Draft } from '../lib/review';
import { Task } from '../lib/types';
import { theme } from '../theme';

type Props = {
  question: CheckinQuestion;
  /** The course's open tasks, the ones "Something changed" lets the student fix. */
  tasks: Task[];
  /** Called with the tasks the server saved, so the forecast can use them. */
  onSaved: (tasks: Task[]) => void;
  /** Hides the card. */
  onClose: () => void;
};

/** The boxes start with what the app has now. */
const toBoxes = (task: Task): Draft => ({
  title: task.title,
  week: String(task.dueWeek),
  hours: task.estimatedHours === null ? '' : String(task.estimatedHours),
});

/**
 * #155: the check-in question on the Forecast tab (screen 2 of
 * docs/ui/ai-screens.html). The server chose the course; every week and hour
 * here comes from the semester, and nothing is saved until a button is tapped.
 */
export function CheckinCard({ question, tasks, onSaved, onClose }: Props) {
  const [changing, setChanging] = useState(false);
  const [boxes, setBoxes] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, toBoxes(t)]))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setBox = (id: string, field: 'week' | 'hours', text: string) =>
    setBoxes((current) => ({ ...current, [id]: { ...current[id], [field]: text } }));

  /** Sends one answer. Hides the card when the server has kept it. */
  const send = async (answer: CheckinAnswer, changes?: CheckinChange[]) => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await answerCheckin(question.courseId, answer, changes);
      onSaved(saved);
      onClose();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** Checks every box, then sends only the tasks whose week or hours changed. */
  const save = () => {
    const changes: CheckinChange[] = [];
    for (const task of tasks) {
      const checked = checkDraft(boxes[task.id]);
      if (!checked.ok) {
        setMessage(`${task.title}: ${checked.error}`);
        return;
      }
      const { dueWeek, estimatedHours } = checked.value;
      if (dueWeek !== task.dueWeek || estimatedHours !== task.estimatedHours) {
        changes.push({ taskId: task.id, dueWeek, estimatedHours });
      }
    }
    if (changes.length === 0) {
      setMessage('Change a week or the hours, or tap None of these.');
      return;
    }
    send('changed', changes);
  };

  return (
    <View testID="checkin-card" style={styles.card}>
      <Text style={styles.eyebrow}>One question</Text>
      <Text style={styles.question}>
        {changing ? 'Something changed. Which of these?' : question.text}
      </Text>
      {!changing && question.reason !== null && <Text style={styles.reason}>{question.reason}</Text>}

      {changing ? (
        <>
          {tasks.map((task) => (
            <View key={task.id} style={styles.row}>
              <Text style={styles.title} numberOfLines={1}>{task.title}</Text>
              <Text style={styles.unit}>Week</Text>
              <TextInput
                testID={`checkin-week-${task.id}`}
                accessibilityLabel={`Week ${task.title} is due`}
                value={boxes[task.id].week}
                onChangeText={(text) => setBox(task.id, 'week', text)}
                keyboardType="number-pad"
                style={styles.input}
              />
              <Text style={styles.unit}>Hours</Text>
              <TextInput
                testID={`checkin-hours-${task.id}`}
                accessibilityLabel={`Hours ${task.title} takes`}
                value={boxes[task.id].hours}
                onChangeText={(text) => setBox(task.id, 'hours', text)}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          ))}
          <View style={styles.buttons}>
            <Pressable testID="checkin-save" accessibilityRole="button" disabled={saving} onPress={save} style={[styles.button, saving && styles.off]}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
            <Pressable testID="checkin-none" accessibilityRole="button" disabled={saving} onPress={() => send('none-of-these')} style={styles.plain}>
              <Text style={styles.plainText}>None of these</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.buttons}>
          <Pressable testID="checkin-yes" accessibilityRole="button" disabled={saving} onPress={() => send('on-schedule')} style={[styles.button, saving && styles.off]}>
            <Text style={styles.buttonText}>Yes, still accurate</Text>
          </Pressable>
          <Pressable testID="checkin-changed" accessibilityRole="button" disabled={saving} onPress={() => setChanging(true)} style={styles.plain}>
            <Text style={styles.plainText}>Something changed</Text>
          </Pressable>
        </View>
      )}

      {message !== null && <Text testID="checkin-error" style={styles.error}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.accentSoft, borderRadius: 14, padding: theme.space.md, gap: theme.space.sm },
  eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  question: { color: theme.ink, fontSize: 17, fontWeight: '700' },
  reason: { color: theme.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  title: { flex: 1, color: theme.ink, fontSize: 14 },
  unit: { color: theme.muted, fontSize: 12 },
  input: {
    width: 48,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    color: theme.ink,
    fontSize: 15,
    paddingVertical: 6,
    textAlign: 'center',
  },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: theme.space.md, paddingVertical: 10 },
  off: { opacity: 0.6 },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
  plain: { borderWidth: 1, borderColor: theme.accent, borderRadius: 999, paddingHorizontal: theme.space.md, paddingVertical: 10 },
  plainText: { color: theme.accent, fontSize: 15, fontWeight: '700' },
  error: { color: theme.heavy, fontSize: 13 },
});
