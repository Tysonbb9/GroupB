import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  value: string;
  /** Smaller text after the value, such as "/ 15 hrs". */
  unit?: string;
  color?: string;
  align?: 'left' | 'right';
  testID?: string;
  accessibilityLabel: string;
};

/** One large number with a small label above it. */
export function Figure({
  label,
  value,
  unit,
  color = theme.ink,
  align = 'left',
  testID,
  accessibilityLabel,
}: Props) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={align === 'right' && styles.right}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>
        {value}
        {unit !== undefined && <Text style={styles.unit}> {unit}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  right: { alignItems: 'flex-end' },
  label: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.faint,
    fontWeight: '600',
  },
  value: { fontSize: 24, fontWeight: '800' },
  unit: { fontSize: 11, fontWeight: '600', color: theme.muted },
});
