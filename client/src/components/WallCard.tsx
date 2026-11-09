import Ionicons from '@expo/vector-icons/Ionicons';
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

/** White at partial strength, for the quieter text on the teal card. */
const ON_ACCENT_SOFT = 'rgba(255, 255, 255, 0.78)';

/**
 * The one place on Forecast that tells the student what to do. It leads with
 * the action ("Start Midterm 1 in week 5."), then says why: the next week over
 * capacity with both figures, and how long the heavy stretch lasts. It is the
 * only solid-colour card in the app, so it reads as the thing to act on.
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
      <View testID="crunch-summary" style={[styles.card, styles.clearCard]}>
        <View style={[styles.bubble, styles.clearBubble]}>
          <Ionicons name="checkmark-done" size={20} color={theme.calm} />
        </View>
        <View style={styles.clearText}>
          <Text style={styles.clearTitle}>Nothing over capacity ahead</Text>
          <Text style={styles.clearSub}>Every remaining week fits in {capacity} hours</Text>
        </View>
      </View>
    );
  }

  const why = (
    <Text style={recommendation !== null ? styles.why : styles.headline}>
      Week {wall.week} needs {wholeHours(wall.hours)} hours. You have {capacity} free that week.
    </Text>
  );

  return (
    <View testID="crunch-summary" style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="flag" size={13} color={ON_ACCENT_SOFT} />
        <Text style={styles.eyebrow}>Next crunch · week {wall.week}</Text>
      </View>

      {recommendation !== null ? (
        <View testID="start-recommendation" style={styles.stack}>
          <Text style={styles.headline}>
            Start {recommendation.task.title}{' '}
            {recommendation.startWeek <= currentWeek
              ? 'now'
              : `in week ${recommendation.startWeek}`}
            .
          </Text>
          <Text style={styles.why}>
            About {wholeHours(recommendation.task.estimatedHours ?? 0)} hours of work.
          </Text>
          {why}
          {period !== null && period.endWeek > period.startWeek && (
            <Text testID="crunch-period" style={styles.why}>
              Weeks {period.startWeek}–{period.endWeek} are over capacity
            </Text>
          )}
          <Pressable
            testID="plan-link"
            accessibilityRole="link"
            accessibilityLabel="Plan this week"
            onPress={onPlan}
            style={styles.plan}
          >
            <Text style={styles.planText}>Plan this week</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.accent} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.stack}>
          {why}
          {period !== null && period.endWeek > period.startWeek && (
            <Text testID="crunch-period" style={styles.why}>
              Weeks {period.startWeek}–{period.endWeek} are over capacity
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ON_ACCENT_SOFT,
  },
  stack: { gap: 4 },
  headline: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
  why: { fontSize: 13, color: ON_ACCENT_SOFT, lineHeight: 18 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: theme.space.sm,
  },
  planText: { fontSize: 13, fontWeight: '800', color: theme.accent },
  clearCard: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  bubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  clearBubble: { backgroundColor: `${theme.calm}22` },
  clearText: { flex: 1, gap: 2 },
  clearTitle: { fontSize: 15, fontWeight: '800', color: theme.ink },
  clearSub: { fontSize: 13, color: theme.muted },
});
