import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WeekLoad } from '../lib/types';
import { wholeHours } from '../lib/workload';
import { loadColor, theme } from '../theme';
import { CapacityEditor } from './CapacityEditor';

const STRIP_HEIGHT = 110;

/**
 * The semester at a glance: one bar per week, height by projected hours,
 * colour by how it sits against the student's capacity. The dashed line
 * is the capacity itself, so "over the line" is literal.
 *
 * The selected week (the current week until the student taps another) is
 * outlined. The current week is numbered in the accent colour and the next
 * week over capacity in the warning colour, so the two weeks that matter can
 * be found without counting.
 */
export function WeekStrip({
  loads,
  capacity,
  currentWeek,
  selectedWeek,
  wallWeek,
  onSelectWeek,
  onSaveCapacity,
  capacityOf = () => capacity,
}: {
  loads: WeekLoad[];
  /** The student's weekly number: the line, unless a week has its own hours. */
  capacity: number;
  currentWeek: number;
  selectedWeek: number;
  wallWeek: number | null;
  onSelectWeek: (week: number) => void;
  /** When given, the line under the strip can change the capacity (US-32). */
  onSaveCapacity?: (hours: number) => Promise<void>;
  /** The hours in each week, where some weeks have their own (#148). Defaults to `capacity`. */
  capacityOf?: (week: number) => number;
}) {
  const peak = Math.max(capacity, ...loads.map((l) => Math.max(l.hours, capacityOf(l.week))));

  return (
    <View>
      <View style={styles.strip}>
        {/* One piece of dashed line per week, so it steps at a week with its own hours (#148). */}
        {loads.map((load, i) => (
          <View
            key={`line-${load.week}`}
            testID={`capacity-line-${load.week}`}
            style={[
              styles.capacityLine,
              {
                left: `${(i / loads.length) * 100}%`,
                width: `${100 / loads.length}%`,
                bottom: (capacityOf(load.week) / peak) * STRIP_HEIGHT,
              },
            ]}
          />
        ))}
        {loads.map((load) => (
          <View key={load.week} style={styles.column}>
            <Pressable
              testID={`week-bar-${load.week}`}
              accessibilityRole="button"
              accessibilityLabel={
                capacityOf(load.week) === capacity
                  ? `Week ${load.week}, ${wholeHours(load.hours)} hours`
                  : `Week ${load.week}, ${wholeHours(load.hours)} hours, you have ${capacityOf(load.week)} that week`
              }
              accessibilityState={{ selected: load.week === selectedWeek }}
              onPress={() => onSelectWeek(load.week)}
              style={[
                styles.bar,
                {
                  height: Math.max(2, (load.hours / peak) * STRIP_HEIGHT),
                  backgroundColor: loadColor(load.hours, capacityOf(load.week)),
                },
                load.week === selectedWeek && styles.barSelected,
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.axis}>
        {loads.map((load) => (
          <Text
            key={load.week}
            testID={`week-axis-${load.week}`}
            style={[
              styles.axisLabel,
              load.week === currentWeek && styles.axisNow,
              load.week === wallWeek && styles.axisWall,
            ]}
          >
            {load.week}
          </Text>
        ))}
      </View>

      {onSaveCapacity ? (
        <CapacityEditor capacity={capacity} onSave={onSaveCapacity} />
      ) : (
        <Text style={styles.capacityNote}>Dashed line is your {capacity} hours a week</Text>
      )}
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
    borderTopWidth: 1,
    borderTopColor: theme.faint,
    borderStyle: 'dashed',
  },
  column: { flex: 1, paddingHorizontal: 1.5, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barSelected: { borderWidth: 1.5, borderColor: theme.ink },
  axis: { flexDirection: 'row', marginTop: theme.space.xs },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: theme.faint,
  },
  axisNow: { color: theme.accent, fontWeight: '700' },
  axisWall: { color: theme.heavy, fontWeight: '700' },
  capacityNote: {
    marginTop: theme.space.sm,
    fontSize: 11,
    color: theme.muted,
  },
});
