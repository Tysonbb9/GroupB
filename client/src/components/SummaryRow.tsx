import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  testID: string;
  /** The row's symbol, in a tinted circle, so each row is recognisable at a glance. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** The colour of the symbol; its circle is the same colour, faint. */
  tint: string;
  title: string;
  /** One short line saying what is behind the tap. */
  detail: string;
  onPress: () => void;
};

/**
 * One line that opens the full version somewhere else: a symbol, a title, a
 * short summary and a chevron. Option A (#96) keeps Forecast to one focus and
 * puts everything else one tap away behind rows like this.
 */
export function SummaryRow({ testID, icon, tint, title, detail, onPress }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      onPress={onPress}
      style={styles.row}
    >
      {/* The tint at about 13% opacity (two hex digits of alpha). */}
      <View style={[styles.bubble, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: 14,
    paddingHorizontal: theme.space.md,
  },
  bubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: theme.ink },
  detail: { fontSize: 13, color: theme.muted },
});
