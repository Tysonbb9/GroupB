import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Task } from '../lib/types';
import { theme } from '../theme';

type Props = {
  /** The tasks that are marked done. */
  tasks: Task[];
  courseCode: (courseId: string) => string;
  /** Marks a finished task as not done again. */
  onUndo: (taskId: string) => void;
};

/**
 * The finished work, one line until it is opened. Marking a task done takes it
 * off the This week list, so this is where a mistaken tap is reversed: open the
 * line, tap the filled circle, and the task goes back (US-31).
 *
 * Closed by default so the screen stays about what is left to do. Nothing is
 * drawn when no task is done.
 */
export function CompletedTasks({ tasks, courseCode, onUndo }: Props) {
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="completed-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Completed, ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
        onPress={() => setOpen((current) => !current)}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{`Completed (${tasks.length})`}</Text>
        <Text style={styles.chevron}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>

      {open &&
        tasks.map((task) => (
          <View key={task.id} testID={`completed-${task.id}`} style={styles.row}>
            <View style={styles.main}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.metaText}>{courseCode(task.courseId)}</Text>
            </View>

            <Pressable
              testID={`undo-${task.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: true }}
              accessibilityLabel={`Mark ${task.title} not done`}
              hitSlop={10}
              style={styles.check}
              onPress={() => onUndo(task.id)}
            />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.sm },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.space.sm,
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: theme.muted },
  chevron: { fontSize: 12, color: theme.faint },
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
  title: { fontSize: 14, fontWeight: '700', color: theme.muted, textDecorationLine: 'line-through' },
  metaText: { fontSize: 11, color: theme.muted },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.accent,
    backgroundColor: theme.accent,
  },
});
