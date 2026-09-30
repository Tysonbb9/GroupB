import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** A small caps label with a rule running out to the edge. */
export function SectionHeader({ label, warn = false }: { label: string; warn?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header">
      <Text style={[styles.label, warn && styles.warn]}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, marginTop: 4 },
  label: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: theme.faint,
  },
  warn: { color: theme.heavy },
  rule: { flex: 1, height: 1, backgroundColor: theme.rule },
});
