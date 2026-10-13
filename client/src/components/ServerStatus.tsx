import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** Shown while the semester is on its way from the server. */
export function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator testID="loading" color={theme.accent} />
      <Text style={styles.note}>Loading your semester</Text>
    </View>
  );
}

/** Shown when the semester could not be loaded. Says why, and lets the user retry. */
export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Could not load your semester</Text>
      <Text testID="error-message" style={styles.note}>
        {message}
      </Text>
      <Pressable
        testID="retry"
        accessibilityRole="button"
        onPress={onRetry}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    padding: theme.space.lg,
    backgroundColor: theme.bg,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.ink },
  note: { fontSize: 14, color: theme.muted, textAlign: 'center' },
  button: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius,
    backgroundColor: theme.accent,
  },
  buttonText: { color: theme.surface, fontWeight: '600' },
});
