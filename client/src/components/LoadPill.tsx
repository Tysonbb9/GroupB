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
 * One word for how a week sits against capacity: Fits, Busy or Over, so the
 * header says it before any number. The dot and the tint carry the load
 * colour; the word is in ink, because the load colours are too light to read
 * as small text on their own tint (Busy was 2.4 to 1).
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
      <View testID="load-pill-dot" style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{WORDS[band]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '800', color: theme.ink },
});
