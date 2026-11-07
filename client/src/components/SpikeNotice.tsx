import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UpcomingSpike } from '../lib/difficulty';
import { wholeHours } from '../lib/workload';
import { loadColor, theme } from '../theme';

type Props = {
  notices: UpcomingSpike[];
  capacity: number;
};

/**
 * Heads-up cards for course spikes in the next few weeks. Each one reads like
 * a calendar entry: the week in a block on the left, the course and its hours
 * on the right, and a bar showing how much of that week the course alone takes.
 */
export function SpikeNotice({ notices, capacity }: Props) {
  if (notices.length === 0) return null;

  return (
    <View testID="spike-notices" style={styles.list}>
      {notices.map((notice) => {
        const hours = wholeHours(notice.hours);
        const share = Math.min(1, notice.hours / capacity);
        const color = loadColor(notice.hours, capacity);

        return (
          <View
            key={`${notice.course.id}-${notice.week}`}
            testID={`spike-notice-${notice.course.id}-${notice.week}`}
            accessible
            accessibilityLabel={`${notice.course.code} difficulty spike in week ${notice.week}, ${hours} estimated hours out of ${capacity}`}
            style={styles.card}
          >
            <View style={styles.week}>
              <Text style={styles.weekLabel}>Week</Text>
              <Text style={styles.weekNumber}>{notice.week}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.course}>{notice.course.code}</Text>
              <Text style={styles.hours}>
                {hours} of your {capacity} hours
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.sm,
  },
  week: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.accent,
  },
  weekNumber: { fontSize: 22, fontWeight: '800', color: theme.accent },
  body: { flex: 1, gap: 3 },
  course: { fontSize: 15, fontWeight: '800', color: theme.ink },
  hours: { fontSize: 13, color: theme.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.bg, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6, borderRadius: 3 },
});
