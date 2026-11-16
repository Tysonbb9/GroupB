import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WEEKS_IN_SEMESTER } from '../lib/types';
import { theme } from '../theme';

type Props = {
  /** The week of the semester we are in, from semester.currentWeek. */
  week: number;
};

/**
 * Which week of the semester it is, as a chip under the screen's title
 * (US-46, #161). It used to be a small grey line above the title, and a
 * first-time reader did not see it.
 */
export function WeekChip({ week }: Props) {
  const text = `Week ${week} of ${WEEKS_IN_SEMESTER}`;
  return (
    <View
      testID="week-chip"
      accessible
      accessibilityLabel={`${text} of the semester`}
      style={styles.chip}
    >
      <Ionicons name="calendar-outline" size={14} color={theme.accent} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: theme.space.xs,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.accentSoft,
  },
  text: { fontSize: 14, fontWeight: '800', color: theme.accent },
});
