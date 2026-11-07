import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoadBand, loadBand } from '../lib/workload';
import { loadColor, theme } from '../theme';

const WORDS: Record<LoadBand, string> = {
  calm: 'Fits',
  moderate: 'Busy',
  heavy: 'Over',
};

/**
 * One word for how a week sits against capacity: Fits, Busy or Over, in the
 * same load colours as the bars, so the header says it before any number.
 */
export function LoadPill({ hours, capacity }: { hours: number; capacity: number }) {
  const band = loadBand(hours, capacity);
  const color = loadColor(hours, capacity);

  return (
    <View
      testID="load-pill"
      accessible
      accessibilityLabel={`This week: ${WORDS[band].toLowerCase()}`}
      // The band colour at about 13% opacity (two hex digits of alpha).
      style={[styles.pill, { backgroundColor: `${color}22` }]}
    >
      <Text style={[styles.text, { color }]}>{WORDS[band]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  text: { fontSize: 13, fontWeight: '800', color: theme.ink },
});
