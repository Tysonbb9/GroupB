import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';
import { theme } from '../theme';

/** Opens the welcome again (US-47), from the top of Forecast and the empty screens. */
export function HelpButton() {
  const router = useRouter();
  return (
    <Pressable
      testID="open-welcome"
      accessibilityRole="button"
      accessibilityLabel="How Crunch Week works"
      hitSlop={10}
      onPress={() => router.push('/welcome')}
    >
      <Ionicons name="help-circle-outline" size={26} color={theme.accent} />
    </Pressable>
  );
}