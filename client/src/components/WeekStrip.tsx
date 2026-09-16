import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WeekLoad } from '../lib/types';
import { loadColor, theme } from '../theme';

const STRIP_HEIGHT = 110;

/**
 * The semester at a glance: one bar per week, height by projected hours,
 * colour by how it sits against the student's capacity. The dashed line
 * is the capacity itself, so "over the line" is literal.
 */
export function WeekStrip({
  loads,
  capacity,
  currentWeek,
}: {
  loads: WeekLoad[];
  capacity: number;
  currentWeek: number;
}) {
  const peak = Math.max(capacity, ...loads.map((l) => l.hours));

  return (
    <View>
      <View style={styles.strip}>
        <View
          style={[styles.capacityLine, { bottom: (capacity / peak) * STRIP_HEIGHT }]}
        />
        {loads.map((load) => (
          <View key={load.week} style={styles.column}>
            <View
              testID={`week-bar-${load.week}`}
              accessibilityLabel={`Week ${load.week}, ${Math.round(load.hours)} hours`}
              style={[
                styles.bar,
                {
                  height: Math.max(2, (load.hours / peak) * STRIP_HEIGHT),
                  backgroundColor: loadColor(load.hours, capacity),
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.axis}>
        {loads.map((load) => (
          <Text
            key={load.week}
            style={[styles.axisLabel, load.week === currentWeek && styles.axisNow]}
          >
            {load.week}
          </Text>
        ))}
      </View>

      <Text style={styles.capacityNote}>
        Dashed line is your {capacity} hours a week
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: STRIP_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: theme.rule,
  },
  capacityLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: theme.faint,
    borderStyle: 'dashed',
  },
  column: { flex: 1, paddingHorizontal: 1.5, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  axis: { flexDirection: 'row', marginTop: theme.space.xs },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: theme.faint,
  },
  axisNow: { color: theme.accent, fontWeight: '700' },
  capacityNote: {
    marginTop: theme.space.sm,
    fontSize: 11,
    color: theme.muted,
  },
});
