import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Task } from '../lib/types';
import { hoursLabel } from '../lib/workload';
import { theme } from '../theme';
import { CategoryTile } from './CategoryTile';
import { EstimateEditor } from './EstimateEditor';

type Props = {
  task: Task;
  courseCode: string;
  /** The week the task was due, when it is overdue. */
  overdueSince: number | null;
  /** Not yet due, but the week to begin it has arrived. */
  startNow: boolean;
  onDone: () => void;
  onEstimate: (hours: number) => void;
};

/**
 * One assignment as a row: category tile, title and details, and a circular
 * checkbox. A circle reads as a state to toggle rather than an action
 * competing with the title for attention.
 */
export function TaskRow({
  task,
  courseCode,
  overdueSince,
  startNow,
  onDone,
  onEstimate,
}: Props) {
  return (
    <View testID={`row-${task.id}`} style={styles.row}>
      <CategoryTile category={task.category} />

      <View style={styles.main}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.meta}>
          {overdueSince !== null && (
            <Text style={[styles.metaText, styles.overdue]}>Was week {overdueSince}</Text>
          )}
          <Text style={styles.metaText}>{courseCode}</Text>
          {task.estimatedHours !== null ? (
            <Text style={styles.metaText}>{hoursLabel(task.estimatedHours)}</Text>
          ) : (
            <EstimateEditor taskId={task.id} title={task.title} onSave={onEstimate} />
          )}
          {startNow && <Text style={[styles.metaText, styles.startNow]}>start now</Text>}
        </View>
      </View>

      <Pressable
        testID={`done-${task.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={`Mark ${task.title} done`}
        hitSlop={10}
        style={styles.check}
        onPress={onDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: theme.ink },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm },
  metaText: { fontSize: 11, color: theme.muted },
  overdue: { color: theme.heavy, fontWeight: '700' },
  startNow: { color: theme.accent, fontWeight: '700' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.faint,
  },
});
