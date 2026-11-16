import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryTile } from '../../components/CategoryTile';
import { CATEGORY_INFO } from '../../lib/categories';
import { MAX_ESTIMATE_HOURS, parseEstimate } from '../../lib/estimate';
import { Task } from '../../lib/types';
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

/**
 * US-44 (#159): an assignment's details, opened by tapping it on This week.
 *
 * It shows what the app knows about the task: its title, course, kind, due
 * week, the weeks a long task is spread over, and its hours. The hours can be
 * changed here. They are saved on the server first, so the forecast only
 * changes to hours that were kept; if saving fails, the old hours stay and
 * the screen says so.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { semester, saveEstimate } = useSemester();
  const task = semester.tasks.find((t) => t.id === id);

  const [text, setText] = useState(task?.estimatedHours == null ? '' : String(task.estimatedHours));
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

  const save = async () => {
    const parsed = parseEstimate(text);
    if (!parsed.ok) {
      setSaved(false);
      setProblem(`Enter hours more than 0 and up to ${MAX_ESTIMATE_HOURS}, or leave it blank.`);
      return;
    }
    // The same hours again: nothing to save.
    if (parsed.hours === task.estimatedHours) {
      setProblem(null);
      setSaved(true);
      return;
    }
    setSaving(true);
    setProblem(null);
    setSaved(false);
    try {
      await saveEstimate(task.id, parsed.hours);
      setSaved(true);
    } catch (error) {
      setProblem(`Could not save, so the hours have not changed. ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
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
        <Text style={styles.label}>Change the hours</Text>
        <View style={styles.row}>
          <TextInput
            testID="task-hours-input"
            accessibilityLabel={`Hours for ${task.title}`}
            value={text}
            onChangeText={(value) => {
              setText(value);
              setSaved(false);
            }}
            keyboardType="decimal-pad"
            placeholder="hours"
            placeholderTextColor={theme.faint}
            style={[styles.input, problem !== null && styles.inputProblem]}
          />
          <Pressable
            testID="task-hours-save"
            accessibilityRole="button"
            accessibilityLabel={`Save hours for ${task.title}`}
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={save}
            style={[styles.save, saving && styles.saveOff]}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <Text style={styles.help}>
          More than 0 and up to {MAX_ESTIMATE_HOURS}. Leave it blank if you do not know yet.
        </Text>
        {problem !== null && (
          <Text testID="task-hours-problem" accessibilityLiveRegion="polite" style={styles.problem}>
            {problem}
          </Text>
        )}
        {saved && (
          <Text testID="task-hours-saved" accessibilityLiveRegion="polite" style={styles.saved}>
            Saved. Your forecast uses these hours now.
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
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  input: {
    width: 88,
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
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs + 4,
  },
  saveOff: { opacity: 0.6 },
  saveText: { fontSize: 14, fontWeight: '700', color: theme.surface },
  help: { fontSize: 12, color: theme.muted },
  problem: { fontSize: 13, fontWeight: '600', color: theme.heavy },
  saved: { fontSize: 13, fontWeight: '600', color: theme.accent },
});
