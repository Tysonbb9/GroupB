import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryTile } from '../../components/CategoryTile';
import { CATEGORY_INFO } from '../../lib/categories';
import { MAX_ESTIMATE_HOURS } from '../../lib/estimate';
import { checkTaskEdit, editTextFor, TaskEditText } from '../../lib/task-edit';
import { Task, WEEKS_IN_SEMESTER } from '../../lib/types';
import { hoursLabel } from '../../lib/workload';
import { useSemester } from '../../state/semester-store';
import { theme } from '../../theme';

/** One labelled line of the details, such as "Due · Week 6". */
function Detail({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}`} style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/** The due week, and whether it has passed with the work not done. */
function dueText(task: Task, currentWeek: number): string {
  const overdue = !task.done && task.dueWeek < currentWeek;
  return `Week ${task.dueWeek}${overdue ? ' · overdue' : ''}`;
}

/** The weeks a long task is worked on, ending at its due week, or null for one week. */
function spreadText(task: Task): string | null {
  const weeks = task.spreadWeeks ?? 1;
  if (weeks <= 1) return null;
  return `Weeks ${task.dueWeek - weeks + 1}–${task.dueWeek}`;
}

/** The hours as they read on the details, or a plain "not set" when there are none. */
function hoursText(hours: number | null): string {
  return hours === null ? 'Not set yet' : hoursLabel(hours).replace(' hrs', ' hours').replace(' hr', ' hour');
}

/** One box of the edit card, with its label above it. */
function Field({
  label,
  testID,
  value,
  onChange,
  numeric,
  problem,
}: {
  label: string;
  testID: string;
  value: string;
  onChange: (text: string) => void;
  numeric?: 'number-pad' | 'decimal-pad';
  problem: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ?? 'default'}
        style={[styles.input, problem && styles.inputProblem]}
      />
    </View>
  );
}

/**
 * US-44 (#159): an assignment's details, opened by tapping it on This week.
 *
 * It shows what the app knows about the task: its title, course, kind, due
 * week, the weeks a long task is spread over, and its hours. The due week
 * and hours can be corrected here, with one Save. The title is left out for
 * now. Only what changed is
 * sent, and it is saved on the server first, so the forecast only changes to
 * what was kept; if saving fails, nothing changes and the screen says so.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { semester, saveTask } = useSemester();
  const task = semester.tasks.find((t) => t.id === id);

  const [text, setText] = useState<TaskEditText>(
    task === undefined ? { dueWeek: '', hours: '' } : editTextFor(task)
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (task === undefined) {
    return (
      <View testID="task-missing" style={styles.page}>
        <Text style={styles.missing}>This assignment is no longer in your semester.</Text>
      </View>
    );
  }

  const course = semester.courses.find((c) => c.id === task.courseId);
  const kind = task.category === undefined ? 'Not sorted' : CATEGORY_INFO[task.category].label;
  const spread = spreadText(task);

  const type = (field: keyof TaskEditText) => (value: string) => {
    setText((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const save = async () => {
    const checked = checkTaskEdit(task, text);
    if (!checked.ok) {
      setSaved(false);
      setProblem(checked.problem);
      return;
    }
    setProblem(null);
    // Nothing differs from the task: nothing to save.
    if (Object.keys(checked.change).length === 0) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await saveTask(task.id, checked.change);
      setSaved(true);
    } catch (error) {
      setProblem(`Could not save, so nothing has changed. ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <CategoryTile category={task.category} />
        <View style={styles.names}>
          <Text testID="task-title" accessibilityRole="header" style={styles.title}>
            {task.title}
          </Text>
          <Text style={styles.course}>
            {course === undefined ? '' : `${course.code} · ${course.name}`}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Detail testID="task-due" label="Due" value={dueText(task, semester.currentWeek)} />
        {spread !== null && <Detail testID="task-spread" label="Worked on" value={spread} />}
        <Detail testID="task-kind" label="Kind" value={kind} />
        <Detail testID="task-status" label="Status" value={task.done ? 'Done' : 'To do'} />
        <Detail testID="task-hours" label="Hours" value={hoursText(task.estimatedHours)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Change the details</Text>
        <View style={styles.row}>
          <Field
            label="Due week"
            testID="task-week-input"
            value={text.dueWeek}
            onChange={type('dueWeek')}
            numeric="number-pad"
            problem={problem !== null}
          />
          <Field
            label="Hours"
            testID="task-hours-input"
            value={text.hours}
            onChange={type('hours')}
            numeric="decimal-pad"
            problem={problem !== null}
          />
        </View>
        <Text style={styles.help}>
          Week 1 to {WEEKS_IN_SEMESTER}. Hours more than 0 and up to {MAX_ESTIMATE_HOURS}; leave them blank if you
          do not know yet.
        </Text>
        <Pressable
          testID="task-save"
          accessibilityRole="button"
          accessibilityLabel={`Save changes to ${task.title}`}
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={save}
          style={[styles.save, saving && styles.saveOff]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        {problem !== null && (
          <Text testID="task-problem" accessibilityLiveRegion="polite" style={styles.problem}>
            {problem}
          </Text>
        )}
        {saved && (
          <Text testID="task-saved" accessibilityLiveRegion="polite" style={styles.saved}>
            Saved. Your forecast uses these details now.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: theme.space.md, gap: theme.space.md },
  missing: { fontSize: 15, color: theme.muted },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  names: { flex: 1, gap: 2 },
  title: { fontSize: 22, fontWeight: '800', color: theme.ink },
  course: { fontSize: 13, color: theme.muted },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.sm },
  detailLabel: { fontSize: 14, color: theme.muted },
  detailValue: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: theme.ink, textAlign: 'right' },
  label: { fontSize: 14, fontWeight: '700', color: theme.ink },
  row: { flexDirection: 'row', gap: theme.space.sm },
  field: { gap: 4, width: 110 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.muted },
  input: {
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs + 2,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.bg,
  },
  inputProblem: { borderColor: theme.heavy },
  save: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs + 4,
  },
  saveOff: { opacity: 0.6 },
  saveText: { fontSize: 14, fontWeight: '700', color: theme.surface },
  help: { fontSize: 12, color: theme.muted },
  problem: { fontSize: 13, fontWeight: '600', color: theme.heavy },
  saved: { fontSize: 13, fontWeight: '600', color: theme.accent },
});
