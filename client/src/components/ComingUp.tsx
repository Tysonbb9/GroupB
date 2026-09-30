import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CATEGORY_INFO } from '../lib/categories';
import { Course, Task } from '../lib/types';
import { hoursLabel } from '../lib/workload';
import { categoryColor, theme } from '../theme';

type Props = {
  tasks: Task[];
  courses: Course[];
  currentWeek: number;
};

/**
 * A two-column grid of the next assignments. It gives the forecast specifics
 * without becoming a full task list. Each card carries the assignment's
 * category, and its estimated hours when there is an estimate.
 */
export function ComingUp({ tasks, courses, currentWeek }: Props) {
  if (tasks.length === 0) return null;

  const courseCode = (id: string) => courses.find((c) => c.id === id)?.code ?? '';

  return (
    <View testID="coming-up">
      <Text style={styles.label}>Coming up</Text>
      <View style={styles.grid}>
        {tasks.map((task) => {
          const color = categoryColor(task.category);
          const when =
            task.dueWeek === currentWeek ? 'Due this week' : `Week ${task.dueWeek}`;

          return (
            <View key={task.id} testID={`up-${task.id}`} style={styles.card}>
              <View style={[styles.edge, { backgroundColor: color }]} />
              {task.category !== undefined && (
                <Text style={[styles.badge, { color, backgroundColor: `${color}1F` }]}>
                  {CATEGORY_INFO[task.category].label}
                </Text>
              )}
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.meta}>
                {when} · {courseCode(task.courseId)}
              </Text>
              {task.estimatedHours !== null && (
                <Text style={styles.hours}>{hoursLabel(task.estimatedHours)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
    marginBottom: theme.space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  card: {
    width: '48.5%',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.sm,
    paddingLeft: theme.space.md,
    gap: 4,
    overflow: 'hidden',
  },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  title: { fontSize: 14, fontWeight: '700', color: theme.ink },
  meta: { fontSize: 11, color: theme.muted },
  hours: { fontSize: 11, fontWeight: '600', color: theme.muted },
});
