import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UpcomingSpike } from '../lib/difficulty';
import { wholeHours } from '../lib/workload';
import { theme } from '../theme';

type Props = {
  notices: UpcomingSpike[];
  capacity: number;
};

/** Short, in-app heads-up cards for course spikes in the next few weeks. */
export function SpikeNotice({ notices, capacity }: Props) {
  if (notices.length === 0) return null;

  return (
    <View testID="spike-notices" style={styles.section}>
      <View>
        <Text style={styles.label}>Heads up</Text>
        <Text style={styles.basis}>Based on estimated hours</Text>
      </View>
      <View style={styles.list}>
        {notices.map((notice) => {
          const hours = wholeHours(notice.hours);
          const sentence = `${notice.course.code} needs ${hours} of your ${capacity} hours in week ${notice.week}`;

          return (
            <View
              key={`${notice.course.id}-${notice.week}`}
              testID={`spike-notice-${notice.course.id}-${notice.week}`}
              accessibilityLabel={`${notice.course.code} difficulty spike in week ${notice.week}, ${hours} estimated hours out of ${capacity}`}
              style={styles.card}
            >
              <Text style={styles.title}>{sentence}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space.sm },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
  },
  list: { gap: theme.space.sm },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    borderLeftWidth: 3,
    borderLeftColor: theme.moderate,
    padding: theme.space.md,
  },
  title: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  basis: { color: theme.muted, fontSize: 11, marginTop: 3 },
});
