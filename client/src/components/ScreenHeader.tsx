import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { WeekChip } from './WeekChip';

type Props = {
  /** A short line above the title that places the screen in the semester. */
  eyebrow: React.ReactNode;
  title: string;
  /** The week of the semester we are in, shown as a chip under the title. */
  week?: number;
  /** Anything that belongs beside the title: a load label, a button. */
  right?: React.ReactNode;
};

/**
 * The top of every tab: where you are in the semester, a large title, and
 * whatever belongs beside it. It replaces the plain navigation header so each
 * screen opens with a heading that says what it is for (Option A, #96).
 */
export function ScreenHeader({ eyebrow, title, week, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {week !== undefined && <WeekChip week={week} />}
      </View>
      {right !== undefined && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  text: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.muted,
  },
  title: { fontSize: 30, fontWeight: '800', color: theme.ink },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingBottom: 4 },
});
