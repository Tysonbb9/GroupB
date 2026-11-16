import Ionicons from '@expo/vector-icons/Ionicons';
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
  /**
   * US-45: the task was just ticked done. It stays in its place, looking done,
   * with Undo, until the hours question under it is answered or skipped.
   */
  markedDone?: boolean;
  /** Marks the task not done again. Used while `markedDone` is true. */
  onUndo?: () => void;
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
  markedDone = false,
  onUndo,
}: Props) {
  return (
    <View testID={`row-${task.id}`} style={styles.row}>
      <CategoryTile category={task.category} />

      <View style={styles.main}>
        <Text style={[styles.title, markedDone && styles.titleDone]}>{task.title}</Text>
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
        {markedDone && (
          <View style={styles.meta}>
            <Text style={[styles.metaText, styles.markedDone]}>Marked done</Text>
            <Pressable
              testID={`row-undo-${task.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Undo marking ${task.title} done`}
              hitSlop={8}
              onPress={onUndo}
            >
              <Text style={styles.undo}>Undo</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* A faint tick inside the circle says what tapping it does. */}
      {/* Once ticked, the circle fills in, and tapping it again is the same as Undo. */}
      <Pressable
        testID={`done-${task.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: markedDone }}
        accessibilityLabel={markedDone ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        accessibilityHint={markedDone ? 'Puts its hours back on the forecast' : 'Takes its hours off the forecast'}
        hitSlop={10}
        onPress={markedDone ? onUndo : onDone}
      >
        <Ionicons
          name={markedDone ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={30}
          color={markedDone ? theme.accent : theme.faint}
        />
      </Pressable>
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
  titleDone: { color: theme.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm },
  metaText: { fontSize: 11, color: theme.muted },
  overdue: { color: theme.heavy, fontWeight: '700' },
  startNow: { color: theme.accent, fontWeight: '700' },
  markedDone: { color: theme.accent, fontWeight: '700' },
  undo: { fontSize: 11, color: theme.accent, fontWeight: '700', textDecorationLine: 'underline' },
});
