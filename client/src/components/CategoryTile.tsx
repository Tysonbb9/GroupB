import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Category, CATEGORY_INFO } from '../lib/categories';
import { categoryColor } from '../theme';

/**
 * The two-letter tile an assignment carries. The letters mean colour is never
 * the only signal. An unknown category gets a neutral tile with no letters.
 */
export function CategoryTile({ category }: { category: Category | undefined }) {
  const info = category === undefined ? null : CATEGORY_INFO[category];

  return (
    <View
      accessible
      accessibilityLabel={info?.label ?? 'No category'}
      style={[styles.tile, { backgroundColor: categoryColor(category) }]}
    >
      {info !== null && <Text style={styles.letters}>{info.tile}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letters: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});
