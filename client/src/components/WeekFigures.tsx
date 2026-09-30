import React from 'react';
import { StyleSheet, View } from 'react-native';
import { wholeHours } from '../lib/workload';
import { theme } from '../theme';
import { Figure } from './Figure';

type Props = {
  /** Projected hours landing in the current week. */
  hoursThisWeek: number;
  capacity: number;
  /** The next week over capacity, or null when every remaining week fits. */
  wallWeek: number | null;
};

/**
 * The two figures above the week strip: what lands this week against what
 * the student has, and which week is the next wall. They answer "how am I
 * doing" before the student has to read the chart.
 */
export function WeekFigures({ hoursThisWeek, capacity, wallWeek }: Props) {
  const hours = wholeHours(hoursThisWeek);

  return (
    <View style={styles.row}>
      <Figure
        testID="figure-this-week"
        label="This week"
        value={String(hours)}
        unit={`/ ${capacity} hrs`}
        accessibilityLabel={`This week: ${hours} of ${capacity} hours`}
      />
      <Figure
        testID="figure-next-wall"
        label="Next wall"
        value={wallWeek === null ? 'none' : `wk ${wallWeek}`}
        color={wallWeek === null ? theme.calm : theme.heavy}
        align="right"
        accessibilityLabel={
          wallWeek === null ? 'Next wall: none' : `Next wall: week ${wallWeek}`
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: theme.space.sm,
  },
});
