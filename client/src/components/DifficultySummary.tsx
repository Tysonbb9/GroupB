import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CourseSpikeSummary } from '../lib/difficulty';
import { hoursLabel } from '../lib/workload';
import { theme } from '../theme';

type Props = {
  summaries: CourseSpikeSummary[];
};

function weekList(weeks: number[]): string {
  if (weeks.length === 1) return `${weeks[0]}`;
  if (weeks.length === 2) return `${weeks[0]} and ${weeks[1]}`;
  return `${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;
}

/** Per-course forecast of unusually demanding weeks. */
export function DifficultySummary({ summaries }: Props) {
  const withSpikes = summaries.filter((summary) => summary.spikes.length > 0);
  if (withSpikes.length === 0) return null;

  return (
    <View testID="difficulty-summary" style={styles.section}>
      <View>
        <Text style={styles.label}>Course difficulty spikes</Text>
        <Text style={styles.basis}>Based on estimated hours</Text>
      </View>
      <View style={styles.card}>
        {withSpikes.map((summary, index) => {
          const weeks = summary.spikes.map((spike) => spike.week);
          const peak = `${summary.course.code} peaks in week ${summary.peakWeek} at ${hoursLabel(summary.peakHours).replace(' hrs', ' hours').replace(' hr', ' hour')}`;

          return (
            <View
              key={summary.course.id}
              accessibilityLabel={`${summary.course.code} has difficulty spikes in weeks ${weekList(weeks)}, based on estimated hours`}
              style={[styles.row, index > 0 && styles.divided]}
            >
              <Text style={styles.peak}>{peak}</Text>
              <Text style={styles.weeks}>Weeks {weekList(weeks)}</Text>
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
  basis: { color: theme.muted, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    paddingHorizontal: theme.space.md,
  },
  row: { paddingVertical: theme.space.sm },
  divided: { borderTopWidth: 1, borderTopColor: theme.rule },
  peak: { color: theme.ink, fontSize: 13, fontWeight: '700' },
  weeks: { color: theme.muted, fontSize: 11, marginTop: 3 },
});
