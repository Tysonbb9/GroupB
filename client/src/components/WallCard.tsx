import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CrunchWindow, WeekLoad } from '../lib/types';
import { StartRecommendation, wholeHours } from '../lib/workload';
import { theme } from '../theme';

type Props = {
  /** The next week over capacity, or null when every remaining week fits. */
  wall: WeekLoad | null;
  /** The run of over-capacity weeks the wall belongs to. */
  period: CrunchWindow | null;
  capacity: number;
  currentWeek: number;
  /** What to start to ease the wall, when there is something to start. */
  recommendation: StartRecommendation | null;
  /** Opens the planning view for the week. */
  onPlan: () => void;
};

/**
 * The one place on the Semester screen that tells the student what to do.
 * It states the next wall with both figures, says how long the heavy stretch
 * lasts, and names a single assignment to start and when.
 */
export function WallCard({
  wall,
  period,
  capacity,
  currentWeek,
  recommendation,
  onPlan,
}: Props) {
  if (wall === null) {
    return (
      <View testID="crunch-summary" style={[styles.card, styles.clear]}>
        <Text style={styles.title}>Nothing over capacity ahead</Text>
        <Text style={styles.sub}>Every remaining week fits in {capacity} hours</Text>
      </View>
    );
  }

  return (
    <View testID="crunch-summary" style={styles.card}>
      <View>
        <Text style={styles.title}>
          Week {wall.week} needs {wholeHours(wall.hours)} hours
        </Text>
        <Text style={styles.sub}>You have {capacity} free that week</Text>
        {period !== null && period.endWeek > period.startWeek && (
          <Text testID="crunch-period" style={styles.period}>
            Weeks {period.startWeek}–{period.endWeek} are over capacity
          </Text>
        )}
      </View>

      {recommendation !== null && (
        <View testID="start-recommendation" style={styles.action}>
          <Text style={styles.actionText}>
            <Text style={styles.actionStrong}>
              Start {recommendation.task.title}{' '}
              {recommendation.startWeek <= currentWeek
                ? 'now'
                : `in week ${recommendation.startWeek}`}
              .
            </Text>{' '}
            About {wholeHours(recommendation.task.estimatedHours ?? 0)} hours of
            work.
          </Text>
          <Pressable
            testID="plan-link"
            accessibilityRole="link"
            accessibilityLabel="Plan this week"
            onPress={onPlan}
          >
            <Text style={styles.plan}>Plan →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    borderLeftWidth: 3,
    borderLeftColor: theme.heavy,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  clear: { borderLeftColor: theme.calm },
  title: { fontSize: 14, fontWeight: '800', color: theme.ink },
  sub: { fontSize: 11, color: theme.muted, marginTop: 2 },
  period: { fontSize: 11, color: theme.heavy, fontWeight: '600', marginTop: 2 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    backgroundColor: theme.accentSoft,
    borderRadius: theme.radius,
    padding: theme.space.sm,
  },
  actionText: { flex: 1, fontSize: 12, color: theme.ink, lineHeight: 17 },
  plan: { fontSize: 12, fontWeight: '700', color: theme.accent },
  actionStrong: { fontWeight: '700' },
});
